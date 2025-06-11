/**
 * @typedef {Object} AppConfig
 * 
 * @property {string} iimage_imported_resources_folder - Enonic object ID where the images should be imported
 * @property {string} iimage_host - Imageshop Integration host
 * @property {string} iimage_token 
 * @property {string} iimage_private_key
 * @property {?string} iimage_interface_name
 * @property {?string} iimage_document_prefix
 * @property {?string[]} iimage_sizes
 * @property {?string} iimage_language
 * @property {?string} iimage_language_alt_label - Imageshop name for the alternative text property. Each language has its own name
 * @property {?string} iimage_language_caption - Imageshop name for the caption property. Each language has its own name
 */

/**
 * @typedef {Object} Image
 * @property {string} file - The URL of the image file.
 */

/**
 * @typedef {Object} DocumentInfo
 * @property {number} DocumentInfoTypeId - The ID of the document info type.
 * @property {string} Name - The name of the document info type.
 * @property {?string} Value - The value associated with the document info (nullable).
 */

/**
 * @typedef {Object} LocalizedText
 * @property {?string} title - The title of the document in the specified language (nullable).
 * @property {?DocumentInfo[]} documentinfo - Information about the document in the specified language (nullable).
 */

/**
 * @typedef {Object} TextObject
 * @property {LocalizedText} no - Norwegian language-specific text.
 * @property {LocalizedText} en - English language-specific text.
 * @property {LocalizedText} sv - Swedish language-specific text.
 * @property {LocalizedText} nb - Norwegian Bokmål language-specific text.
 * @property {LocalizedText} nn - Norwegian Nynorsk language-specific text.
 * @property {LocalizedText} da - Danish language-specific text.
 */

/**
 * @typedef {Object} FocalPoint
 * @property {number} x - The X-coordinate of the focal point.
 * @property {number} y - The Y-coordinate of the focal point.
 */

/**
 * @typedef {Object} ImageInfo
 * @property {string} code -
 * @property {Image} image - The image related to the document.
 * @property {TextObject} text - The localized text information for the document.
 * @property {number} documentId - The ID of the document.
 * @property {FocalPoint} focalPoint - The focal point of the document's image.
 */