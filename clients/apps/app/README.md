# Polar App

This repository hosts our iOS and Android App. It's built on top of Expo.

More info & contribution guidelines is coming soon.

## Run the App locally

Start the JavaScript bundle server by running `pnpm start`

## EAS

EAS (Expo Application Services) is used to compile and sign Android/iOS apps with custom native code in the cloud.

### Install the EAS CLI

`npm install eas-cli -g`

### Creating the native build

#### Simulator Build

To build the app for use in a Simulator, run `eas build --platform ios --profile ios-simulator`

#### Production Build

To build the app for production, run `eas build --platform ios --profile production`

### Submitting a build to an App Store

Run `eas submit --ios`
