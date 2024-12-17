function main() {
  const imageShopURL = document.querySelector('[data-image-shop-url]').getAttribute('data-image-shop-url');
  const openImageShopButton = document.getElementById('imageshop-button');
  const syncImageShopInfoButton = document.getElementById('imageshop-sync-info-button')

  function setMessageEventListener (event) {
    const eventData = event.data.split(';')
    const selectedPropertyRadioElement = document.querySelector(`input[name="inputName"]:checked`) || {}

    changeUploadButtonState('loading')

    storeImageInEnonic({
      imageData: JSON.parse(eventData[0]),
      propertyName: selectedPropertyRadioElement.value,
      propertyPath: selectedPropertyRadioElement.getAttribute('data-property-path')
    })
  }

  const imageshop = {
    openWindow: function () {
      if (window.addEventListener) {
        window.addEventListener('message', setMessageEventListener, { once: true });
      } else if (window.attachEvent) {
        window.attachEvent('onmessage', setMessageEventListener);
      } else {
        window['message'] = setMessageEventListener
      }

      window.open(imageShopURL, 'imageshop', "width=950, height=650, scrollbars=1, inline=1");
    }
  };

  openImageShopButton.addEventListener('click', function () {
    imageshop.openWindow();
  });

  if (syncImageShopInfoButton) {
    syncImageShopInfoButton.addEventListener('click', syncImageInfo)
  }
}

/**
 * 
 * @param {MouseEvent} e 
 */
function syncImageInfo(e) {
  const target = e.target
  target.setAttribute('disabled', true)
  target.style.cursor = 'wait';

  const syncImageInfoServiceURL = document.querySelector('[data-sync-image-info-service-url]').getAttribute('data-sync-image-info-service-url')

  fetch(syncImageInfoServiceURL)
    .then(response => response.json())
    .then(data => {})
    .finally(() => {
      target.style.cursor = 'pointer';
      target.removeAttribute('disabled')
    })
}

/**
 * 
 * Requests the Enonic backend to store the image in the Enonic repository
 * @param {Object} params
 * @param {Object} params.imageData image object returned
 * @param {String} params.propertyName object property name to store the image in Enonic
 * @param {String?} params.propertyPath object property path if the input selected is a part
 */
function storeImageInEnonic(params) {
  const imageData = params.imageData
  const propertyName = params.propertyName
  const propertyPath = params.propertyPath

  const importImageServiceUrl = document.querySelector('[data-import-image-service-url]').getAttribute('data-import-image-service-url');
  const openImageShopButton = document.getElementById('imageshop-button');
  const strings = JSON.parse(document.querySelector('[data-strings]').getAttribute('data-strings'));
  
  fetch(importImageServiceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, propertyName, propertyPath })
  })
    .then(response => response.json())
    .then(data => {
      if (data.status === 201 && data.image.editURL) {
        if (document.querySelector('.edit-image-link')) document.querySelector('.edit-image-link').remove();

        setMessageText(data.message, 'success');

        openImageShopButton.insertAdjacentElement('afterend', createEditLink(data.image.editURL));

        if (data.image.wasContentUpdated) window.location.reload();
        return
      }

      if (document.querySelector('.edit-image-link')) document.querySelector('.edit-image-link').remove();
      setMessageText(data.message, 'error');
    })
    .catch(error => {
      console.error('Error:', error);
      if (document.querySelector('.edit-image-link')) document.querySelector('.edit-image-link').remove();
      setMessageText(strings.generalError, 'error');
    })
    .finally(() => {
      setTimeout(() => {
        setMessageText('', 'default');
      }, 10000)
      changeUploadButtonState('default')
    });
}

/**
 * Creates an anchor element to edit the image in the content studio
 * @param {String} editURL content studio edit URL
 * @returns 
 */
function createEditLink(editURL) {
  const strings = JSON.parse(document.querySelector('[data-strings]').getAttribute('data-strings'));

  const editLink = document.createElement('a');
  editLink.className = 'edit-image-link';
  editLink.href = editURL;
  editLink.target = '_blank';
  editLink.innerHTML = strings.editImage;
  return editLink
}

/**
 * Sets the state of the upload button
 * @param {'loading'|'default'} state button state
 * @returns 
 */
function changeUploadButtonState(state) {
  const strings = JSON.parse(document.querySelector('[data-strings]').getAttribute('data-strings'));
  const openImageShopButton = document.getElementById('imageshop-button');

  if (state === 'loading') {
    openImageShopButton.setAttribute('disabled', true);
    openImageShopButton.innerHTML = strings.importingImage;
    openImageShopButton.style.cursor = 'wait';
    return
  }

  if (state === 'default') {
    openImageShopButton.removeAttribute('disabled');
    openImageShopButton.innerHTML = strings.openImageShop;
    openImageShopButton.style.cursor = 'pointer';
    return
  }
}

/**
 * Receives a message and sets the text and status of the message element
 * @param {String} message text to display
 * @param {String} status status of the message. It can be 'success', 'error' or 'default'
 */
function setMessageText(message, status) {
  const messageElement = document.getElementById('imageshop-message');
  const messageTextElement = messageElement.querySelector('p')

  messageTextElement.innerHTML = message;
  messageElement.setAttribute('data-status', status);
}

main()