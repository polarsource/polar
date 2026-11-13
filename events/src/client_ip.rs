use std::net::IpAddr;

use anyhow::{Context, bail};
use ipnet::IpNet;

pub enum TrustedProxies {
    All,
    Networks(Vec<IpNet>),
}

impl TrustedProxies {
    pub fn parse(value: &str) -> anyhow::Result<Self> {
        if value == "*" {
            return Ok(Self::All);
        }
        if value.is_empty() {
            return Ok(Self::Networks(Vec::new()));
        }
        let mut networks = Vec::new();
        for entry in value.split(',').map(str::trim) {
            let network = if entry.contains('/') {
                let network: IpNet = entry
                    .parse()
                    .with_context(|| format!("invalid network {entry:?}"))?;
                if network != network.trunc() {
                    bail!("network {entry:?} has host bits set");
                }
                network
            } else {
                IpNet::from(
                    entry
                        .parse::<IpAddr>()
                        .with_context(|| format!("invalid address {entry:?}"))?,
                )
            };
            networks.push(network);
        }
        Ok(Self::Networks(networks))
    }

    fn trusts(&self, host: &str) -> bool {
        let Self::Networks(networks) = self else {
            return true;
        };
        let Ok(host) = host.parse::<IpAddr>() else {
            return false;
        };
        networks.iter().any(|network| network.contains(&host))
    }
}

fn host(forwarded: &str) -> &str {
    let forwarded = forwarded.trim();
    if let Some(bracketed) = forwarded.strip_prefix('[') {
        if let Some((host, remainder)) = bracketed.split_once(']')
            && (remainder.is_empty() || remainder.starts_with(':'))
        {
            return host;
        }
    } else if forwarded.matches(':').count() == 1 {
        let (host, port) = forwarded.rsplit_once(':').unwrap();
        let port = port.trim();
        let digits = port.strip_prefix(['+', '-']).unwrap_or(port);
        if digits
            .split('_')
            .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
        {
            return host;
        }
    }
    forwarded
}

pub fn resolve(
    true_client_ip: Option<&str>,
    forwarded_for: Option<&str>,
    peer: Option<IpAddr>,
    trusted_proxies: &TrustedProxies,
) -> Option<String> {
    if let Some(ip) = true_client_ip {
        return Some(ip.to_owned());
    }
    let peer = peer.map(|peer| peer.to_string());
    if !matches!(trusted_proxies, TrustedProxies::All)
        && !peer
            .as_deref()
            .is_some_and(|peer| trusted_proxies.trusts(peer))
    {
        return peer;
    }
    let hosts = Vec::from_iter(forwarded_for.unwrap_or_default().split(',').map(host));
    let client = match trusted_proxies {
        TrustedProxies::All => hosts.first(),
        TrustedProxies::Networks(_) => hosts
            .iter()
            .rev()
            .find(|host| !trusted_proxies.trusts(host))
            .or(hosts.first()),
    };
    client
        .filter(|client| !client.is_empty())
        .map(|client| (*client).to_owned())
        .or(peer)
}

#[cfg(test)]
mod tests {
    use super::*;

    const FORWARDED: &str = "6.6.6.6, 203.0.113.7, 172.70.1.1, 10.0.0.2";

    fn resolve_forwarded(forwarded: &str, peer: [u8; 4], trusted: &str) -> Option<String> {
        resolve(
            None,
            Some(forwarded),
            Some(IpAddr::from(peer)),
            &TrustedProxies::parse(trusted).unwrap(),
        )
    }

    #[test]
    fn returns_the_first_hop_no_trusted_proxy_vouches_for() {
        let trusted = "172.64.0.0/13, 10.0.0.0/8";

        assert_eq!(
            resolve_forwarded(FORWARDED, [10, 0, 0, 9], trusted).as_deref(),
            Some("203.0.113.7")
        );
        assert_eq!(
            resolve_forwarded("10.0.0.3, 172.70.1.1", [10, 0, 0, 9], trusted).as_deref(),
            Some("10.0.0.3")
        );
        assert_eq!(
            resolve_forwarded("203.0.113.7:4711", [10, 0, 0, 9], trusted).as_deref(),
            Some("203.0.113.7")
        );
    }

    #[test]
    fn ignores_the_header_from_an_untrusted_peer() {
        assert_eq!(
            resolve_forwarded(FORWARDED, [198, 51, 100, 4], "10.0.0.0/8").as_deref(),
            Some("198.51.100.4")
        );
        assert_eq!(
            resolve_forwarded("", [10, 0, 0, 9], "10.0.0.0/8").as_deref(),
            Some("10.0.0.9")
        );
    }

    #[test]
    fn takes_the_first_hop_when_every_proxy_is_trusted() {
        assert_eq!(
            resolve_forwarded(FORWARDED, [198, 51, 100, 4], "*").as_deref(),
            Some("6.6.6.6")
        );
    }

    #[test]
    fn prefers_the_edge_header_and_has_no_address_without_a_peer() {
        let trusted = TrustedProxies::parse("127.0.0.1").unwrap();

        assert_eq!(
            resolve(Some("198.51.100.1"), Some(FORWARDED), None, &trusted).as_deref(),
            Some("198.51.100.1")
        );
        assert_eq!(
            resolve(Some(" "), Some(FORWARDED), None, &trusted).as_deref(),
            Some(" ")
        );
    }
}
