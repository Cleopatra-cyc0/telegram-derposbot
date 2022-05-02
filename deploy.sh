#!/usr/bin/env sh
set -e
docker rmi derposbot:latest &
docker build -t derposbot:latest .
docker save -o ./image.tar derposbot:latest
gzip ./image.tar
scp image.tar.gz mees@s.mees.io:derposbot.tar.gz
rm image.tar.gz
ssh mees@s.mees.io << EOF
  docker rm -f derposbot &
  docker rmi derposbot:latest &
  gzip -d derposbot.tar.gz
  docker load -i derposbot.tar
  rm derposbot.tar
  cd meesio
  docker-compose up -d
EOF
