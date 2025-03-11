# MVS Server dump
Starts up a proxy that dumps both http request/response and websocket messages for multiversus

## Hydra bynary decoder
Messages are encoded in x-ag-binary HYDRA format

> Decoder based on [HydraDotNet](https://github.com/TheNaeem/HydraDotNet) and [MK12-Api](https://github.com/thethiny/MK12-Api/)

> Uses a fork of mockttp [mockttp-mvs](https://github.com/multiversuskoth/mockttp)


## Requirements
Requires:

* node.js (Tested on v20)
* openssl for windows for generating self signed-cert

## Get Started

```bash
npm install
```
### Generate self-signed cert 
```bash
npm run gen-cert

```
### Bundle application
```bash
npm run bundle
```

### Start proxy
Before starting the dumper make sure you change windows proxy settings. It runs on port **8000** and use **127.0.0.1**
```bash
npm start
```
Launch the game and play as usual
When done capturing exit the program and it will create 2 files in the dump folder
One for http requests/response and another for websockets
They are formatted in postman collection schema and can be imported directly to postman for inspection

The original hex is stored in the request detail and for responses is stored on the body of the response