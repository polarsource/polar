{
  description = "Super simple starting point for Polar development flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }@inputs:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; config.allowUnfree = true; };
        in {
          default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [
              nodejs_22
              corepack_22

              python314
              uv

              # Webhooks
              stripe-cli

              # Containers
              docker-client
            ];

            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
              pkgs.stdenv.cc.cc.lib
            ];

            shellHook = ''
              echo "Setting up Polar development environment..."

              # Setup environment files
              ./dev/setup-environment

              # Start Docker containers
              echo "Starting containers..."
              if [ -S /var/run/docker.sock ]; then
                # Docker daemon socket exists, try to use it
                (cd server && docker compose up -d --build)
              else
                echo "ERROR: Docker not found or running"
                return 1 2>/dev/null || exit 1
              fi

              # Setup Python environment, build emails, and run migrations
              echo "Setting up Python environment..."
              (cd server && uv sync && uv run task emails && uv run task db_migrate)

              # Install frontend dependencies
              echo "Installing frontend dependencies..."
              (cd clients && pnpm install)

              echo "Development environment ready!"
            '';
          };
        }
      );
    };
}
