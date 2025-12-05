/// <reference path="../modules/types.js" />

module.exports = {
  convertToWebP
}

/**
 * Converts an image stream to WebP format
 * @param {Object} params
 * @param {Object} params.imageStream - The input image stream (ByteSource or InputStream)
 * @param {Number} params.quality - WebP quality (0-100, default: 85)
 * @returns {Object} ByteSource with WebP image data (compatible with createMedia)
 */
function convertToWebP (params) {
  try {
    const imageStream = params.imageStream
    const quality = params.quality || 85

    if (!imageStream) {
      throw new Error('Image stream is required')
    }

    var ImageIO = Java.type('javax.imageio.ImageIO')
    var ByteArrayOutputStream = Java.type('java.io.ByteArrayOutputStream')
    var ImageWriteParam = Java.type('javax.imageio.ImageWriteParam')
    var IIORegistry = Java.type('javax.imageio.spi.IIORegistry')

    // Try to manually register WebP service providers
    // ImageIO service providers may not be auto-discovered in Enonic XP's classloader
    try {
      var registry = IIORegistry.getDefaultInstance()
      
      // The sejda library (org.sejda.imageio:webp-imageio:0.1.6) uses com.luciad classes internally
      var SpiClass = Java.type('com.luciad.imageio.webp.WebPImageWriterSpi')
      var spi = SpiClass.class.newInstance()
      registry.registerServiceProvider(spi)
    } catch (e) {
      // Service provider registration failed, will rely on ImageIO auto-discovery
    }

    // Convert ByteSource to InputStream if needed
    var inputStream = imageStream
    var isOpenedStream = false
    if (imageStream && typeof imageStream.openStream === 'function') {
      // It's a ByteSource (from HTTP client), convert to InputStream
      inputStream = imageStream.openStream()
      isOpenedStream = true
    }

    try {
      // Read the original image
      var bufferedImage = ImageIO.read(inputStream)

      if (!bufferedImage) {
        throw new Error('Failed to read image from stream')
      }

      // Get WebP writer
      var writers = ImageIO.getImageWritersByMIMEType('image/webp')
      
      // Try alternative method if first attempt fails
      if (!writers || !writers.hasNext()) {
        writers = ImageIO.getImageWritersByFormatName('webp')
      }

      if (!writers || !writers.hasNext()) {
        throw new Error('WebP image writer not available. ImageIO service providers may not work in Enonic XP\'s classloader environment.')
      }

      var writer = writers.next()
      var output = null

      // Configure quality using WebP-specific write param if available
      var writeParam = null
      
      try {
        var WebPWriteParam = Java.type('com.luciad.imageio.webp.WebPWriteParam')
        writeParam = new WebPWriteParam()
        writeParam.setQuality(quality)
      } catch (e) {
        // Fall back to default write param
        writeParam = writer.getDefaultWriteParam()
        
        if (writeParam.canWriteCompressed()) {
          var compressionTypes = writeParam.getCompressionTypes()
          
          if (compressionTypes && compressionTypes.length > 0) {
            writeParam.setCompressionMode(ImageWriteParam.MODE_EXPLICIT)
            writeParam.setCompressionType(compressionTypes[0])
            writeParam.setCompressionQuality(quality / 100.0)
          }
        }
      }

      // Convert to WebP
      var outputStream = new ByteArrayOutputStream()
      
      try {
        output = ImageIO.createImageOutputStream(outputStream)

        writer.setOutput(output)
        writer.write(null, new javax.imageio.IIOImage(bufferedImage, null, null), writeParam)
      } catch (writeError) {
        log.error('Error during WebP write: ' + writeError.message)
        throw new Error('Failed to write WebP image: ' + writeError.message)
      } finally {
        // Dispose writer first, then close output
        if (writer) {
          try {
            writer.dispose()
          } catch (e) {
            // Ignore dispose errors
          }
        }
        
        // Ensure output is properly closed
        if (output) {
          try {
            output.flush()
          } catch (e) {
            // Ignore flush errors
          }
          try {
            output.close()
          } catch (e) {
            // Ignore close errors
          }
        }
      }

      // Get the byte array and create a ByteSource (required by createMedia)
      var webpBytes = outputStream.toByteArray()
      
      if (!webpBytes || webpBytes.length === 0) {
        throw new Error('WebP conversion produced empty byte array')
      }
      
      // Create ByteSource from byte array (Guava library)
      var ByteSource = Java.type('com.google.common.io.ByteSource')
      return ByteSource.wrap(webpBytes)
    } finally {
      // Close the input stream if we opened it from ByteSource
      if (isOpenedStream && inputStream) {
        try {
          inputStream.close()
        } catch (e) {
          // Ignore errors when closing
        }
      }
    }
  } catch (e) {
    log.error(`Error converting image to WebP: ${e.message || e}`)
    throw e
  }
}

