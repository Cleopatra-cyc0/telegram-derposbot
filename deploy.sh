#!/usr/bin/env sh
echo "removing old image"
docker rmi derposbot:latest
set -e
echo "building new image"
docker build -t derposbot:latest .
echo "saving new image to file"
docker save -o ./image.tar derposbot:latest
echo "gzipping file"
gzip ./image.tar
echo "copying file to server"
scp image.tar.gz mees@s.mees.io:derposbot.tar.gz
echo "removing file"
rm image.tar.gz
ssh mees@s.mees.io << EOF
  echo removing container
  docker rm -f derposbot
  echo removing old image from server
  docker rmi derposbot:latest &
  echo un-gzipping new image &
  gzip -d derposbot.tar.gz
  echo loading new image
  docker load -i derposbot.tar
  echo removing file from server
  rm derposbot.tar
  cd meesio
  echo recreating derposbot
  docker-compose up -d
EOF
