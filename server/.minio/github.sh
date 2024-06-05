echo "I'm being called from GitHub Actions!"

wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc

bash ./configure.sh
