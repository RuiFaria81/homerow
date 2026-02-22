{
  description = "Custom Webmail Application (SolidStart)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-darwin" "aarch64-linux" ];
    in {
      packages = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          nodejs = pkgs.nodejs_22;
        in {
          default = pkgs.buildNpmPackage {
            pname = "custom-webmail";
            version = "1.0.0";

            src = pkgs.lib.cleanSource ./.;

            inherit nodejs;

            # After first build attempt, replace with the hash from the error:
            #   nix build .#packages.x86_64-linux.default 2>&1 | grep 'got:'
            npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

            # We provide our own build phase via vinxi
            dontNpmBuild = true;

            buildPhase = ''
              runHook preBuild
              npx vinxi build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/webmail $out/bin
              cp -r .output/* $out/lib/webmail/

              # Install production node_modules for the server
              cp -r .output/server/node_modules $out/lib/webmail/server/

              cat > $out/bin/webmail-server <<SCRIPT
              #!/usr/bin/env bash
              exec ${nodejs}/bin/node $out/lib/webmail/server/index.mjs "\$@"
              SCRIPT
              chmod +x $out/bin/webmail-server
              runHook postInstall
            '';

            meta = {
              description = "Custom SolidStart webmail client";
              mainProgram = "webmail-server";
            };
          };
        }
      );
    };
}
