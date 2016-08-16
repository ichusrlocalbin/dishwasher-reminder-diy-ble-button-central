FROM hypriot/rpi-node

ADD . /dishwasher

WORKDIR /dishwasher

RUN apt-get update && apt-get install -y libudev-dev bluez bluetooth usbutils
RUN npm install

ENTRYPOINT ["npm", "run"]

CMD ["shell"]
