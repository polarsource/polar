{
  description = "Polar development shell";

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

          # packageManager pins a pnpm version that pnpm would otherwise download, which
          # NixOS can't run. Set in a wrapper since turbo strips env vars from tasks.
          pnpm = pkgs.symlinkJoin {
            name = "pnpm-${pkgs.pnpm_12.version}";
            paths = [ pkgs.pnpm_12 ];
            nativeBuildInputs = [ pkgs.makeWrapper ];
            postBuild = ''
              for bin in $out/bin/*; do
                wrapProgram "$bin" --set pnpm_config_manage_package_manager_versions false
              done
            '';
          };

          # workerd from npm is a generic-linux binary NixOS can't exec, and nixpkgs
          # doesn't package it. Miniflare (used by cf and the Vite plugin) spawns
          # MINIFLARE_WORKERD_PATH instead, so run the newest installed one through
          # Nix's glibc loader.
          workerd = pkgs.writeShellScriptBin "workerd" ''
            root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
              echo "workerd: run this inside the Polar repository" >&2
              exit 1
            }
            bin="$(printf '%s\n' "$root"/clients/node_modules/.pnpm/@cloudflare+workerd-linux-*/node_modules/@cloudflare/workerd-linux-*/bin/workerd | sort -V | tail -n1)"
            [ -x "$bin" ] || {
              echo "workerd: not installed yet; run pnpm install in clients/" >&2
              exit 1
            }
            exec ${pkgs.stdenv.cc.bintools.dynamicLinker} "$bin" "$@"
          '';
        in {
          default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [
              nodejs_24
              pnpm

              # server/ requires Python 3.14 and runs everything through uv
              python314
              uv
              # Tinybird's install.sh (run by dev up) does `uv tool install tinybird --python 3.11`
              python311

              # sdk/generator tasks and packages/cli tests
              just
              bun

              # dev/create-test-db and dev/create-worktree
              postgresql_18

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
              export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
              export MINIFLARE_WORKERD_PATH="${workerd}/bin/workerd"
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
