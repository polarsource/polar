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
          # Its plugin tests fail on aarch64-linux, so nixpkgs ships no cached build there
          stripe-cli =
            if pkgs.stdenv.hostPlatform.system == "aarch64-linux"
            then pkgs.stripe-cli.overrideAttrs { doCheck = false; }
            else pkgs.stripe-cli;
        in {
          default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [
              # Node 24 (.nvmrc); corepack provides the pnpm pinned in packageManager
              nodejs_24
              corepack_24

              # server/ requires Python 3.14 and runs everything through uv
              python314
              uv

              # sdk/generator tasks and packages/cli tests
              just
              bun

              # Webhooks
              stripe-cli
              ngrok
            ];
          };
        });
    };
}
