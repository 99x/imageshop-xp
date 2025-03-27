# ImageShop

This repository contains an application designed to facilitate the integration of Enonic XP-based sites with the ImageShop platform. The application includes features for efficiently importing, editing, and synchronizing images between the site and the ImageShop media library.

## Key Features

- **Installation check**: Automatically detects if the ImageShop app is installed on configured sites.
- **Image import**: Enables importing images directly from ImageShop into the site environment.
- **Information synchronization**: Displays a synchronization button to update information for already imported images.
- **Informative error messages**: Provides visual feedback in case of installation issues, misconfiguration, or detection of multiple installations.
- **Thymeleaf template integration**: Renders the user interface using Thymeleaf templates for consistent presentation.

## How It Works

The application handles HTTP requests and performs the following checks and actions:
1. Checks whether ImageShop is installed on the current site.
2. Retrieves content based on the `contentId` provided in the request.
3. Validates the app configuration and returns appropriate error messages if any issues are found.
4. Constructs a model with service URLs, translation strings, and control variables for the user interface.
5. Renders the interface using the `iimage.html` template, which includes import and sync buttons.

This application is ideal for development teams looking to integrate ImageShop seamlessly and effectively into their Enonic XP-based projects.

## Setup
### Building

```bash
git clone https://github.com/99x/imageshop-xp.git
cd imageshop-xp
./gradlew build
```

### Installation

1. **Install the application**: Deploy the `ImageShop` in your Enonic XP environment via Enonic market in the applications tool or build it yourself.
2. **Configure the application on your site**:
   - Ensure that the application is set up in your site structure.
   - In the site configuration, you will need to fill in the following inputs:

     - **Imported resources folder**
     - **Host**
     - **Token**
     - **Private Key**
     - **Interface Name** (optional, used when searching images)
     - **Document Prefix** (optional, used as a prefix for uploaded images)
     - **Sizes** (optional, format example: `Normal 320x240;320x240`)
     - **Language** (optional, default language for image searches)

   These inputs ensure the proper configuration and functionality of the ImageShop integration in your site.
3. **Alternative Token and Private Key Configuration**:  
   The **Token** and **Private Key** required for HTTP requests to the ImageShop endpoint can also be provided through the configuration file `io.99x.imageshop.cfg`. Use the following variables in the file:

   - `imageshopToken`: Specify the ImageShop token.
   - `imageshopPrivateKey`: Specify the ImageShop private key.
   - `imageshopUploadToken`: Specify the ImageShop token for upload feature.
   - `imageshopUploadPrivateKey`: Specify the ImageShop private key for upload feature.

   This approach offers a centralized and secure way to manage these credentials.



## Releases and Compatibility

| Version | XP version   |
| ------- | ------------ |
| 1.0.x  | 7.9.0       |
| 2.0.x  | 7.11.0      |

## License and credits
The application is licensed under the [Enonic License](https://github.com/99x/imageshop-xp/blob/main/LICENSE.txt)

Made by [99x](https://99x.io)