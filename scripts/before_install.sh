#!/bin/bash

DIR="/home/ec2-user/watch-together"
if [ -d "$DIR" ]; then
    echo "${DIR} exists"
else
    echo "Creating ${DIR}"
    mkdir ${DIR}
fi