{
  description = "Polar development shell (WIP)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }:
    let
      systems = [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system:
        f (import nixpkgs { inherit system; config.allowUnfree = true; }));
    in {
      devShells = forAllSystems (pkgs:
        let
          stripe-cli =
            if pkgs.stdenv.hostPlatform.system == "aarch64-linux"
            then pkgs.stripe-cli.overrideAttrs { doCheck = false; }
            else pkgs.stripe-cli;

          # Same lookup as dev/cli/install's alias, so it works from any subdirectory or worktree
          polar-dev = pkgs.writeShellScriptBin "dev" ''
            root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
              echo "dev: run this inside the Polar repository" >&2
              exit 1
            }
            exec ${pkgs.runtimeShell} "$root/dev/cli/dev" "$@"
          '';

          # pnpm 12 ships as a generic-linux binary that NixOS can't run, so corepack's
          # download fails there. Patch the official binary instead; keep in sync with
          # packageManager in clients/package.json.
          pnpmVersion = "12.8.0";
          pnpmLinux = {
            x86_64-linux = { arch = "x64"; hash = "sha256-xwEBMvujPSv6ApKDVdGsgpGHOqsvTISaNPU4YsS3Qrs="; };
            aarch64-linux = { arch = "arm64"; hash = "sha256-VJHwSZxAB2dUM+RMfdhn0VJ1RjuLzKBTsSNbbj4gNyA="; };
          }.${pkgs.stdenv.hostPlatform.system} or null;
          pnpm = pkgs.stdenv.mkDerivation {
            pname = "pnpm";
            version = pnpmVersion;
            src = pkgs.fetchurl {
              url = "https://registry.npmjs.org/@pnpm/exe.linux-${pnpmLinux.arch}/-/exe.linux-${pnpmLinux.arch}-${pnpmVersion}.tgz";
              inherit (pnpmLinux) hash;
            };
            nativeBuildInputs = [ pkgs.autoPatchelfHook ];
            buildInputs = [ pkgs.stdenv.cc.cc.lib ];
            installPhase = ''
              install -Dm755 pnpm $out/bin/pnpm
              ln -s pnpm $out/bin/pn
            '';
          };
        in {
          default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [
              nodejs_24
              (if pnpmLinux != null then pnpm else corepack_24)

              # server/ requires Python 3.14 and runs everything through uv
              python314
              uv
              # dev up installs the Tinybird CLI via `uv tool install tinybird --python 3.11`
              python311

              # sdk/generator tasks and packages/cli tests
              just
              bun

              # Webhooks
              stripe-cli

              polar-dev
            ];

            # uv's own portable Python builds are generic-linux binaries that can't
            # run on NixOS (no /lib64/ld-linux); make it use the interpreters this
            # shell already provides instead of downloading its own.
            UV_PYTHON_DOWNLOADS = "never";

            shellHook = pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
              # manylinux wheels (greenlet, numpy, pillow, ...) dynamically link
              # against libstdc++.so.6, which isn't on NixOS's default library path.
              export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:$LD_LIBRARY_PATH"
            '' + ''
              # The Docker daemon is a system service this shell can't provide
              if ! command -v docker >/dev/null || ! timeout 3 docker info >/dev/null 2>&1; then
                echo "warning: Docker isn't reachable, and dev up needs it for Postgres, Redis, MinIO and Tinybird." >&2
                if command -v docker >/dev/null; then
                  echo "  Start the daemon (sudo systemctl start docker) and check you're in the docker group." >&2
                elif [ -e /etc/NIXOS ]; then
                  echo "  Enable it in your NixOS config, then log out and back in:" >&2
                  echo "    virtualisation.docker.enable = true;" >&2
                  echo "    users.users.$USER.extraGroups = [ \"docker\" ];" >&2
                else
                  echo "  Install Docker and make sure the daemon is running." >&2
                fi
              fi
            '';
          };
        });
    };
}
