{
  description = "Super simple starting point for Polar development flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }@inputs:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; config.allowUnfree = true; };
        in {
          default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [
              nodejs_24
              corepack_24

              python314
              # dev up installs the Tinybird CLI via `uv tool install tinybird --python 3.11`
              python311

              # Polar dev CLI (dev/cli/dev) shells out to `uv run -s`
              uv

              # Webhooks
              stripe-cli
            ];

            # uv's own portable Python builds are generic-linux binaries that can't
            # run on NixOS (no /lib64/ld-linux); make it use the interpreters this
            # shell already provides instead of downloading its own.
            UV_PYTHON_DOWNLOADS = "never";

            shellHook = ''
              export PATH="$PWD/dev/cli:$PATH"
            '' + pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
              # manylinux wheels (greenlet, numpy, pillow, ...) dynamically link
              # against libstdc++.so.6, which isn't on NixOS's default library path.
              export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:$LD_LIBRARY_PATH"
            '';
          };
        });
    };
}
