/**
 * embroidery-popup.js (FULL FILE)
 * Transparent overlay button that sits EXACTLY on top of the real "Add" button.
 * - Overlay is visible (display:block) when Terms are UNTICKED: it intercepts clicks and shows the error.
 * - Overlay is hidden (display:none) when Terms are TICKED: the real Add button is usable.
 * - Error message is placed OUTSIDE .so-terms, directly below it.
 * - Includes robust positioning even when the modal opens from display:none.
 */
(function () {
  const root = document.getElementById('customPopup');
  if (!root) return;

  const btnClose = document.getElementById('closePopup');
  const btnAdd   = document.getElementById('applyCustomization'); // may start disabled in markup
  const btnReset = document.getElementById('resetCustomization');
  const terms    = document.getElementById('so-terms');
  const actions  = root.querySelector('.so-actions');

  // Containers for terms and actions (may be hidden when no type is selected)
  const termsContainer  = root.querySelector('.so-terms');
  const actionsContainer = root.querySelector('.so-actions');
  if (!btnAdd || !actions) return;

  // ---------- Embroidery live preview ----------
  // When the customer types their name or changes colour, font or
  // placement, we update the overlay text on the product image.  This gives
  // immediate visual feedback about how their embroidery will look.
  const previewEl = root.querySelector('#embroideryPreview');
  // When a logo is uploaded, we display it via this <img> overlay on the
  // product image.  Hidden by default.  Note: since Uploadery handles
  // uploads, we no longer use our own file input and preview overlay.
  const logoPreview = root.querySelector('#logoPreview');
  // Inputs for the two personalisation types.  When the user selects
  // "Add My Name", they can enter a title and a name, choose placement,
  // colour and font.  When "Add My Logo" is chosen, they upload a file and
  // choose placement and colour only.  We locate all of these fields up
  // front so that listeners can be attached once.  Note: some of these
  // elements live inside a form that may be hidden depending on the
  // selected type.
  const typeRadios    = Array.from(root.querySelectorAll('input[name="emb_type"]'));
  const nameForm      = document.getElementById('nameCustomForm');
  const logoForm      = document.getElementById('logoCustomForm');
  const titleInput    = document.getElementById('titleLine');
  const nameInput     = document.getElementById('nameLine2');
  // The logo file input was previously used for uploading images directly.
  // Since the Uploadery app handles file uploads, this element may not
  // exist.  Keep a reference if it does exist but do not rely on it for
  // validation.  Uploadery will insert its own hidden inputs inside
  // #uploadery-container, which we will read later.
  let fileInput     = document.getElementById('logoFile');

  // Track the currently selected type so we can reset fields when switching
  let currentType = '';

  // Utility to reset all inputs in the name form to their defaults
  function clearNameFields() {
    // Clear text inputs
    [titleInput, nameInput].forEach(el => {
      if (el) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    // Reset radio groups for name to first option
    ['placement_name', 'color_name', 'font_name'].forEach(group => {
      const radios = root.querySelectorAll('input[name="' + group + '"]');
      radios.forEach((r, i) => { r.checked = (i === 0); });
    });
  }

  // Utility to reset all inputs in the logo form to their defaults
  function clearLogoFields() {
    // Clear file input
    if (fileInput) fileInput.value = '';
    // Reset radio groups for logo to first option
    ['placement_logo'].forEach(group => {
      const radios = root.querySelectorAll('input[name="' + group + '"]');
      radios.forEach((r, i) => { r.checked = (i === 0); });
    });
  }

  // Update the logo preview image when a logo file is selected or when its
  // placement changes.  Reads the file as a data URL and updates the
  // <img> overlay.  Also applies the appropriate placement classes to
  // align the logo according to the selected placement.  If no file is
  // selected, hides the preview.
  function updateLogoPreview() {
    if (!logoPreview) return;
    const type = getType();
    // Only update preview when in logo or both mode
    if (type !== 'logo' && type !== 'both') {
      logoPreview.style.display = 'none';
      logoPreview.src = '';
      return;
    }
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      // When no native file is selected (i.e. Uploadery is used), attempt to
      // fetch the uploaded logo URL from Uploadery’s hidden inputs.  If a
      // URL is found, display it directly; otherwise hide the preview.
      const details = getUploaderyFileDetails();
      if (details.fileUrl) {
        logoPreview.src = details.fileUrl;
        // Apply placement classes similar to the text preview
        logoPreview.classList.remove('emb-placement-left-chest', 'emb-placement-center', 'emb-placement-right-chest');
        const placement = getSelected('placement_logo');
        if (placement) {
          const normalized = placement.toLowerCase().replace(/\s+/g, '-');
          switch (normalized) {
            case 'left-chest':
              logoPreview.classList.add('emb-placement-left-chest');
              break;
            case 'center':
            case 'centre':
              logoPreview.classList.add('emb-placement-center');
              break;
            case 'right-chest':
              logoPreview.classList.add('emb-placement-right-chest');
              break;
            default:
              logoPreview.classList.add('emb-placement-center');
          }
        }
        // Reposition logo above the text when both name and logo are selected
        const current = getType();
        if (current === 'both') {
          logoPreview.style.top = '42%';
        } else {
          logoPreview.style.top = '41%';
        }
        logoPreview.style.display = '';
      } else {
        logoPreview.style.display = 'none';
        logoPreview.src = '';
        // Reset position to default when no file is selected
        logoPreview.style.top = '41%';
      }
      return;
    }
    // When a native file is selected via the file input (legacy fallback), use
    // FileReader to preview it.  This branch will be taken only if the
    // Uploadery integration is not used.
    const reader = new FileReader();
    reader.onload = function(ev) {
      logoPreview.src = ev.target && ev.target.result ? String(ev.target.result) : '';
      // Apply placement classes similar to the text preview
      logoPreview.classList.remove('emb-placement-left-chest', 'emb-placement-center', 'emb-placement-right-chest');
      const placement = getSelected('placement_logo');
      if (placement) {
        const normalized = placement.toLowerCase().replace(/\s+/g, '-');
        switch (normalized) {
          case 'left-chest':
            logoPreview.classList.add('emb-placement-left-chest');
            break;
          case 'center':
          case 'centre':
            logoPreview.classList.add('emb-placement-center');
            break;
          case 'right-chest':
            logoPreview.classList.add('emb-placement-right-chest');
            break;
          default:
            logoPreview.classList.add('emb-placement-center');
        }
      }
      // Reposition logo when both name and logo are selected
      const current = getType();
      if (current === 'both') {
        logoPreview.style.top = '35%';
      } else {
        logoPreview.style.top = '41%';
      }
      logoPreview.style.display = '';
    };
    reader.readAsDataURL(file);
  }

  // Update the label above the personalisation type pills to reflect the
  // selected type.  When no type is selected, revert to the default
  // instruction.
  function updateTypeLabel() {
    // The label is the element before the emb-type-pills container
    const pills = root.querySelector('.emb-type-pills');
    if (!pills) return;
    const labelEl = pills.previousElementSibling;
    if (!labelEl) return;
    const type = getType();
    if (!type) {
      labelEl.textContent = 'Select Your Personalisation Type';
    } else if (type === 'name') {
      labelEl.textContent = 'Personalisation Type: Name';
    } else if (type === 'logo') {
      labelEl.textContent = 'Personalisation Type: Logo';
    } else if (type === 'both') {
      labelEl.textContent = 'Personalisation Type: Both';
    }
  }

  // Apply a highlight style to the selected personalisation pill.  We
  // directly modify the border, background and colour of the labels for
  // emb_type_name and emb_type_logo.  When neither is selected, both
  // revert to their default styles.
  function updateTypePillStyles() {
    const nameLabel = root.querySelector('label[for="emb_type_name"]');
    const logoLabel = root.querySelector('label[for="emb_type_logo"]');
    const bothLabel = root.querySelector('label[for="emb_type_both"]');
    const resetStyles = (lbl) => {
      if (!lbl) return;
      lbl.style.border = '';
      lbl.style.background = '';
      lbl.style.color = '';
    };
    // Reset all labels
    resetStyles(nameLabel);
    resetStyles(logoLabel);
    resetStyles(bothLabel);
    const type = getType();
    const applyStyles = (lbl) => {
      if (!lbl) return;
      lbl.style.border = '1px solid var(--swatch-selected-border, #ddd)';
      lbl.style.background = 'var(--swatch-selected-background, #000)';
      lbl.style.color = 'var(--swatch-selected-color, #fff)';
    };
    if (type === 'name') {
      applyStyles(nameLabel);
    } else if (type === 'logo') {
      applyStyles(logoLabel);
    } else if (type === 'both') {
      applyStyles(bothLabel);
    }
  }

  // Helpers to get the selected value from a radio group.  Pass in the
  // group name (e.g. "placement_name" or "placement_logo").  Return empty
  // string if none checked.  This allows us to reuse the same function for
  // both name and logo forms.
  function getSelected(name) {
    const radios = root.querySelectorAll(`input[name="${name}"]`);
    for (const r of radios) {
      if (r.checked) return r.value;
    }
    return '';
  }

  // Access the fees attached to the popup via data attributes.  The
  // metafields store the base fee in decimal form (e.g. 16.00).  Convert
  // these to numbers for easy arithmetic.  If the dataset property is
  // missing or cannot be parsed, default to 0.
  const soRight = root.querySelector('.so-right');
  const nameFee = parseFloat(soRight?.dataset.nameFee || '0') || 0;
  const logoFee = parseFloat(soRight?.dataset.logoFee || '0') || 0;

  // Combined fee: sum of name and logo fees.  If an explicit dataset.bothFee is
  // provided, use it; otherwise default to nameFee + logoFee.  This fee is
  // displayed for the "Add Both" option and used for price calculations.
  const bothFee = parseFloat(soRight?.dataset.bothFee || String(nameFee + logoFee)) || 0;

  // ---------------------------------------------------------------------------
  // Uploadery Helpers
  // ---------------------------------------------------------------------------
  /**
   * Determine whether a logo has been uploaded via Uploadery.  Uploadery
   * inserts hidden inputs into the #uploadery-container element when the
   * customer selects and uploads a file.  We consider a logo present if
   * any hidden input within that container has a non‑empty value.
   *
   * @returns {boolean}
   */
  function hasUploaderyLogo() {
    // Check both the visible container and the hidden container for any
    // non-empty hidden inputs.  Uploadery inserts multiple inputs per
    // upload; if any have a value, assume a file has been uploaded.
    const containers = [document.getElementById('uploadery-container'), document.getElementById('uploadery-hidden-container')];
    for (const container of containers) {
      if (!container) continue;
      const inputs = container.querySelectorAll('input[type="hidden"]');
      for (const input of inputs) {
        const val = (input.value || '').trim();
        if (val) return true;
      }
    }
    return false;
  }

  /**
   * Extract the first file name and URL from Uploadery's hidden inputs.
   * Uploadery typically creates multiple hidden inputs for each uploaded file,
   * including one storing the original file name and another storing the
   * uploaded file URL.  Since we do not know the exact naming convention,
   * this function searches for the first hidden input whose value looks
   * like a URL (contains '://') and treats that as the file URL.  If no
   * URL is found, the first non‑empty value is used as the file name.
   *
   * @returns {{ fileName: string, fileUrl: string }}
   */
  function getUploaderyFileDetails() {
    let fileName = '';
    let fileUrl  = '';
    // Search both containers: hidden and visible.  Prefer values from the visible
    // container, but fall back to the hidden one.  If multiple hidden inputs
    // exist, take the first non-empty value as filename and the first URL as
    // fileUrl.
    const containers = [document.getElementById('uploadery-container'), document.getElementById('uploadery-hidden-container')];
    containers.forEach(container => {
      if (!container) return;
      const inputs = container.querySelectorAll('input[type="hidden"]');
      for (const input of inputs) {
        const val = (input.value || '').trim();
        if (!val) continue;
        if (!fileName) fileName = val.split('/').pop();
        if (!fileUrl && val.includes('://')) {
          fileUrl = val;
        }
      }
    });
    if (fileUrl && !fileName) fileName = fileUrl.split('/').pop();
    return { fileName, fileUrl };
  }

  /**
   * Initialise the Uploadery field in the modal.  Uploadery injects its
   * upload button and hidden inputs into the hidden container within the
   * product form at page load.  When the customer opens the personalisation
   * modal and selects the logo option, we call this function to move the
   * Uploadery field into the visible container (#uploadery-container)
   * inside the modal.  We also ensure that any file inputs and hidden
   * inputs are associated with the add‑to‑cart form via the `form`
   * attribute.  This allows Shopify to submit the upload data when the
   * product is added to the cart.
   */
  function initUploaderyField() {
    const hidden = document.getElementById('uploadery-hidden-container');
    const visible = document.getElementById('uploadery-container');
    if (!hidden || !visible) return;
    // If the visible container already has children, assume it's been initialised
    if (visible.children && visible.children.length > 0) return;
    // Move all child nodes from hidden to visible
    while (hidden.firstChild) {
      visible.appendChild(hidden.firstChild);
    }
    // Associate all inputs inside the visible container with the add‑to‑cart form
    const addForm = document.querySelector('form[action*="/cart/add"]');
    if (addForm) {
      const formId = addForm.id || 'product-add-form';
      if (!addForm.id) addForm.id = formId;
      visible.querySelectorAll('input').forEach(function(input) {
        // Only set form attribute if not already set
        if (!input.getAttribute('form')) {
          input.setAttribute('form', formId);
        }
      });
    }
    // Once the Uploadery container is initialised, poll for hidden inputs
    // to detect when a logo has been uploaded.  When a URL appears,
    // immediately update the logo preview and enable the Add button.  This
    // ensures the logo preview becomes visible without further user
    // interaction.  The interval clears itself once a URL is found.
    try {
      const pollInterval = setInterval(() => {
        const details = getUploaderyFileDetails();
        if (details.fileUrl) {
          updateLogoPreview();
          updateAddState();
          clearInterval(pollInterval);
        }
      }, 200);
    } catch (e) {
      console.error('Error starting Uploadery polling', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Associate the logo file input with the add-to-cart form.  Shopify
  // uploads file inputs only when they are inside (or referenced by) a form
  // whose action contains '/cart/add'.  Without setting the `form`
  // attribute, our file input in the modal would not be submitted and
  // the file upload would fail.  We locate the first add-to-cart form on
  // the page and assign its id to the file input.
  (function attachFileToAddForm() {
    const addForms = Array.from(document.querySelectorAll('form[action*="/cart/add"]'));
    const addForm  = addForms[0];
    if (fileInput && addForm) {
      // If the file input does not already reference a form, link it
      if (!fileInput.getAttribute('form')) {
        // Ensure the form has an ID
        if (!addForm.id) addForm.id = 'product-add-form';
        fileInput.setAttribute('form', addForm.id);
      }
    }
  })();

  // ---------------------------------------------------------------------------
  // Upload the logo file via the custom app proxy.  This uses a two‑step
  // process to stage the upload on Shopify's CDN and then finalise it into
  // the store's Files section.  Returns a promise resolving to the final
  // file URL.  Throws on error.
  async function uploadLogo(file) {
    if (!file) throw new Error('No file selected');
    // Step 1: request a staged upload target from our app proxy
    const startRes = await fetch('/apps/logo-upload/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        type: file.type || 'image/png',
        size: file.size || 0
      })
    });
    if (!startRes.ok) {
      const txt = await startRes.text().catch(() => '');
      throw new Error('Upload initiation failed: ' + txt);
    }
    const startData = await startRes.json();
    if (!startData || !startData.uploadUrl) {
      throw new Error('Invalid response from start upload');
    }
    const uploadUrl  = startData.uploadUrl;
    const params     = startData.parameters || [];
    const resourceUrl = startData.resourceUrl;
    // Step 2: perform the actual file upload to the staged target
    const fd = new FormData();
    params.forEach(p => {
      if (p && p.name != null && p.value != null) {
        fd.append(p.name, p.value);
      }
    });
    fd.append('file', file);
    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      body: fd
    });
    if (!upRes.ok) {
      const txt = await upRes.text().catch(() => '');
      throw new Error('Upload failed: ' + txt);
    }
    // Step 3: finalise the uploaded file into Shopify Files
    const finishRes = await fetch('/apps/logo-upload/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceUrl: resourceUrl,
        filename: file.name
      })
    });
    if (!finishRes.ok) {
      const txt = await finishRes.text().catch(() => '');
      throw new Error('Finalize failed: ' + txt);
    }
    const finishData = await finishRes.json();
    if (!finishData || !finishData.url) {
      throw new Error('Invalid response from finish upload');
    }
    return finishData.url;
  }

  // ---------------------------------------------------------------------------
  // Helpers to enable or disable the logo file input depending on the
  // selected personalisation type.  When logo is selected, the file input
  // should be active and required; when switching away from logo, it
  // should be disabled and cleared.  If clearing the file input fails
  // (some browsers block setting .value), we replace the node and
  // reassign the local variable.  After replacement, we reattach the
  // change listener to keep the preview and validation logic intact.
  function enableLogoFileInput() {
    if (!fileInput) return;
    fileInput.disabled = false;
    fileInput.required = true;
  }

  function disableAndClearLogoFileInput() {
    if (!fileInput) return;
    fileInput.required = false;
    fileInput.disabled = true;
    try {
      fileInput.value = '';
    } catch (e) {
      // Some browsers do not allow programmatic clearing of file inputs.
      // Replace the element with a clone to reset its state.  Ensure the
      // clone retains the id, name and form attributes so that
      // submissions still work.  Reattach the change handler so
      // updateLogoPreview and updateAddState are triggered for the new input.
      const fresh = fileInput.cloneNode(true);
      const parent = fileInput.parentNode;
      if (parent) {
        parent.replaceChild(fresh, fileInput);
        fileInput = fresh;
        fileInput.addEventListener('change', () => {
          updateLogoPreview();
          updateAddState();
        });
      }
    }
  }

  // Determine the currently selected personalisation type.
  // Return an empty string if none is selected.  Previously this
  // defaulted to "name", which caused the name form to appear on first
  // open.  Now we defer showing any form until the customer chooses.
  function getType() {
    const r = root.querySelector('input[name="emb_type"]:checked');
    return r ? r.value : '';
  }

  // Update the live preview when the user edits the title, name, placement,
  // colour or font for "Add My Name".  For logo personalisation the
  // preview is hidden altogether.
  function updatePreview() {
    if (!previewEl || !logoPreview) return;
    const type = getType();
    // If no type is selected, hide both previews
    if (!type) {
      previewEl.style.display = 'none';
      logoPreview.style.display = 'none';
      return;
    }
    if (type === 'logo') {
      // Hide text preview and update/show logo preview
      previewEl.style.display = 'none';
      updateLogoPreview();
      return;
    }
    // For combined option we show the text preview and also update the logo preview
    if (type === 'both') {
      // Show text preview and call logo preview update
      previewEl.style.display = '';
      updateLogoPreview();
    } else {
      // For name customisation: show text preview only
      logoPreview.style.display = 'none';
      previewEl.style.display = '';
    }
    // Compose preview text using both title and name.  Join the lines
    // with a newline so that the preview respects multi‑line text.  When
    // neither field has been filled in, show the placeholder "Your Name".
    // Compose preview text using name on the first line and title on the
    // second line.  Previously the title was displayed above the name; we
    // invert the order so that the customer’s name appears first and the
    // title appears below.  If both fields are empty, show the
    // placeholder "Your Name".
    const titleVal = (titleInput?.value || '').trim();
    const nameVal  = (nameInput?.value  || '').trim();
    let text = '';
    if (nameVal) text += nameVal;
    if (titleVal) {
      if (text) text += '\n';
      text += titleVal;
    }
    if (!text) text = 'Your Name';
    previewEl.textContent = text;
    // Adjust vertical position based on type.  When both name and logo
    // personalisations are selected, push the text down so the logo can
    // sit above it.  Revert to the default position for other types.
    if (type === 'both') {
      previewEl.style.top = '44%';
    } else {
      previewEl.style.top = '41%';
    }

    // Placement: use the appropriate group for name customisation
    previewEl.classList.remove('emb-placement-left-chest', 'emb-placement-center', 'emb-placement-right-chest');
    const placement = getSelected('placement_name');
    if (placement) {
      const normalized = placement.toLowerCase().replace(/\s+/g, '-');
      switch (normalized) {
        case 'left-chest':
          previewEl.classList.add('emb-placement-left-chest');
          break;
        case 'center':
        case 'centre':
          previewEl.classList.add('emb-placement-center');
          break;
        case 'right-chest':
          previewEl.classList.add('emb-placement-right-chest');
          break;
        default:
          previewEl.classList.add('emb-placement-center');
      }
    }
    // Colour: apply only for name customisation
    const colour = getSelected('color_name');
    if (colour) previewEl.style.color = colour;
    // Font: apply only for name customisation
    const font = getSelected('font_name');
    if (font) {
      const family = fontMap[font] || font;
      previewEl.style.fontFamily = family;
    }
  }

  // Toggle the visibility of the name and logo forms when the
  // personalisation type changes.  Also update the subhead price text.
  function toggleForms() {
    const type = getType();
    // Hide or show the appropriate form based on the selected type.  If no
    // type is chosen, hide both.
    if (nameForm && logoForm) {
      if (!type) {
        nameForm.style.display = 'none';
        logoForm.style.display = 'none';
        // hide preview
        if (previewEl) previewEl.style.display = 'none';
      } else if (type === 'logo') {
        nameForm.style.display = 'none';
        logoForm.style.display = 'block';
        // Hide preview for logo customisation
        if (previewEl) previewEl.style.display = 'none';
      } else if (type === 'both') {
        // Show both forms for the combined option
        nameForm.style.display = 'block';
        logoForm.style.display = 'block';
        // Show text preview; logo preview is hidden by updatePreview
        if (previewEl) previewEl.style.display = '';
      } else {
        // Default to name: show name form only
        nameForm.style.display = 'block';
        logoForm.style.display = 'none';
        if (previewEl) previewEl.style.display = '';
      }
    }
    // Show or hide the separator between name and logo forms based on type
    const bothSep = document.getElementById('bothFormSeparator');
    if (bothSep) {
      if (type === 'both') {
        bothSep.style.display = '';
      } else {
        bothSep.style.display = 'none';
      }
    }
    // Update subhead text and visibility.  Also toggle the visibility of
    // the terms and actions containers.  Hide them until a type is selected.
    const sub = root.querySelector('.so-subhead');
    if (sub) {
      if (!type) {
        sub.style.display = 'none';
        if (termsContainer)  termsContainer.style.display = 'none';
        if (actionsContainer) actionsContainer.style.display = 'none';
      } else {
        sub.style.display = '';
        if (termsContainer)  termsContainer.style.display = '';
        if (actionsContainer) actionsContainer.style.display = '';
        if (type === 'logo') {
          const money = typeof Shopify !== 'undefined' && Shopify.formatMoney ? Shopify.formatMoney(Math.round(logoFee * 100), Shopify.money_format || '${{amount}}') : ('$' + logoFee.toFixed(2));
          sub.innerHTML = 'Add My Logo <span class="so-price">+ ' + money + '</span>';
        } else if (type === 'both') {
          const money = typeof Shopify !== 'undefined' && Shopify.formatMoney ? Shopify.formatMoney(Math.round(bothFee * 100), Shopify.money_format || '${{amount}}') : ('$' + bothFee.toFixed(2));
          sub.innerHTML = 'Add Both <span class="so-price">+ ' + money + '</span>';
        } else {
          const money = typeof Shopify !== 'undefined' && Shopify.formatMoney ? Shopify.formatMoney(Math.round(nameFee * 100), Shopify.money_format || '${{amount}}') : ('$' + nameFee.toFixed(2));
          sub.innerHTML = 'Add My Name <span class="so-price">+ ' + money + '</span>';
        }
      }
    }
  }

  // Determine whether the Add button should be enabled.  The customer must
  // agree to the terms and provide all required fields for the selected
  // customisation type.  For "name", a non‑empty name OR title is
  // required (allowing the customer to omit one of the two lines).  For
  // "logo", a file must be selected.
  function updateAddState() {
    // Require a type selection before enabling anything
    const type = getType();
    let valid = !!type && terms && terms.checked;
    if (valid && type === 'name') {
      const hasName  = !!(nameInput && nameInput.value.trim());
      const hasTitle = !!(titleInput && titleInput.value.trim());
      valid = hasName || hasTitle;
    } else if (valid && type === 'logo') {
      // When using Uploadery, the file input may not exist.  Instead,
      // determine validity based on whether Uploadery has added any hidden
      // inputs indicating a completed upload.
      valid = hasUploaderyLogo();
    } else if (valid && type === 'both') {
      // Combined: require at least one of title/name AND a logo upload
      const hasName  = !!(nameInput && nameInput.value.trim());
      const hasTitle = !!(titleInput && titleInput.value.trim());
      const hasLogo  = hasUploaderyLogo();
      valid = (hasName || hasTitle) && hasLogo;
    }

    // Trigger a logo preview update whenever the Add state is recalculated
    // for logo or both types.  Uploadery does not emit a change event
    // when a file is uploaded, so we refresh the preview here to ensure
    // the logo image appears as soon as an upload is complete.  This
    // check runs after validity is determined so it executes only when
    // a type is selected.
    if (type === 'logo' || type === 'both') {
      updateLogoPreview();
    }
    btnAdd.disabled = !valid;
    // also control guard overlay
    syncGuard();
  }

  // Map font names (as defined in product metafields) to CSS font families.
  const fontMap = {
    'Block': 'Arial Black, Impact, sans-serif',
    'Script': 'Brush Script MT, cursive',
    'Sans-serif': 'Helvetica, Arial, sans-serif',
    'Serif': 'Times New Roman, serif'
  };

  // ---------------------------------------------------------------------------
  // Event listeners for live interactivity
  // ---------------------------------------------------------------------------
  // When the user types in the title or name fields, update the preview and
  // reevaluate whether the Add button should be enabled.
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      updatePreview();
      updateAddState();
    });
  }
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      updatePreview();
      updateAddState();
    });
  }
  // When the user changes placement, colour or font in the name form, update
  // the preview accordingly.  Note: colours and placement in the logo form do
  // not affect the preview.
  ['placement_name', 'color_name', 'font_name'].forEach(function(group) {
    Array.from(root.querySelectorAll('input[name="' + group + '"]')).forEach(function(radio) {
      radio.addEventListener('change', updatePreview);
    });
  });
  // Placement changes for the logo form affect only the validity of
  // the customisation (they must exist before Add is enabled).
  ['placement_logo'].forEach(function(group) {
    Array.from(root.querySelectorAll('input[name="' + group + '"]')).forEach(function(radio) {
      radio.addEventListener('change', () => {
        updateAddState();
        updateLogoPreview();
      });
    });
  });
  // Personalisation type selector: reset fields when switching types,
  // toggle forms, update preview and price, and reevaluate Add state.
  typeRadios.forEach(function(radio) {
    radio.addEventListener('change', () => {
      const newType = radio.value;
      const prevType = currentType;
      currentType = newType;
      // If switching type, clear the inputs for the previously selected type
      if (prevType && prevType !== newType) {
        // When switching between single types, clear the fields of the other type.
        // Do not clear anything when switching to "both" so previously entered
        // name or logo values are preserved.
        if (newType === 'name') {
          clearLogoFields();
        } else if (newType === 'logo') {
          clearNameFields();
        }
        // Reset terms on any type change
        if (terms) terms.checked = false;
      }
      // Enable or disable the logo file input based on the new type
      if (newType === 'logo') {
        enableLogoFileInput();
      } else {
        disableAndClearLogoFileInput();
      }
      toggleForms();
      updatePreview();
      updateAddState();
      updateTypeLabel();
      updateTypePillStyles();
    });
  });
  // File upload: reenable Add when a file is selected
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      updateLogoPreview();
      updateAddState();
    });
  }
  // Terms checkbox: enable/disable Add and guard overlay
  if (terms) {
    terms.addEventListener('change', updateAddState);
  }
  // Initial synchronisation on load
  requestAnimationFrame(() => {
    toggleForms();
    updatePreview();
    updateAddState();
    updateTypeLabel();
    updateTypePillStyles();
    // Ensure the logo file input is enabled or disabled according to the
    // initially selected type.  If no type is selected, disable it.
    const initialType = getType();
    if (initialType === 'logo') {
      enableLogoFileInput();
    } else {
      disableAndClearLogoFileInput();
    }
  });


  // ---------- Inline terms error (OUTSIDE .so-terms) ----------
  const termsWrap = terms ? terms.closest('.so-terms') : null;
  let termsError = root.querySelector('#so-terms-error');
  if (!termsError && termsWrap) {
    termsError = document.createElement('div');
    termsError.id = 'so-terms-error';
    termsError.className = 'so-error';
    termsError.setAttribute('aria-live', 'polite');
    termsError.style.display = 'none';
    termsError.textContent = "Please confirm you've read and agree to the Terms and Conditions.";
    // Place the error OUTSIDE the .so-terms div, just below it
    termsWrap.insertAdjacentElement('afterend', termsError);
  }

  function showTermsError(show) {
    if (!termsWrap || !termsError) return;
    termsError.style.display = show ? 'block' : 'none';
    termsWrap.classList.toggle('is-error', !!show);
    if (show) {
      termsWrap.classList.remove('is-shake');
      void termsWrap.offsetWidth; // restart animation
      termsWrap.classList.add('is-shake');
    }
  }

  // ---------- Create the transparent overlay button ----------
  const guardBtn = document.createElement('button');
  guardBtn.type = 'button';
  guardBtn.id = 'applyGuard';
  guardBtn.className = 'so-btn-cover'; // relies on .so-actions { position: relative; }
  guardBtn.setAttribute('aria-label', 'Agree to Terms to enable Add');
  guardBtn.setAttribute('tabindex', '0');

  // Ensure overlay sits above the real Add button and is transparent
  Object.assign(guardBtn.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: '0px',
    height: '0px',
    background: 'transparent',
    border: 'none',
    padding: '0',
    margin: '0',
    zIndex: '999',
    display: 'block',
    appearance: 'none',
    WebkitAppearance: 'none',
  });

  // Append overlay as LAST child to maximize stacking precedence
  actions.appendChild(guardBtn);

  // ---------- Helpers ----------
  function isVisible(el) {
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    return cs && cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function positionGuard() {
    // Skip if modal or elements are not yet visible
    if (!isVisible(root) || !isVisible(actions) || !isVisible(btnAdd)) return;

    const aRect = actions.getBoundingClientRect();
    const bRect = btnAdd.getBoundingClientRect();

    guardBtn.style.left   = (bRect.left - aRect.left) + 'px';
    guardBtn.style.top    = (bRect.top  - aRect.top)  + 'px';
    guardBtn.style.width  = bRect.width + 'px';
    guardBtn.style.height = bRect.height + 'px';
  }

  function syncGuard() {
    positionGuard();
    const needsGuard = !(terms && terms.checked);
    guardBtn.style.display = needsGuard ? 'block' : 'none';
    // Keep native disabled state in sync for a11y
    btnAdd.disabled = needsGuard;
    if (!needsGuard) showTermsError(false);
  }

  function nudgeToTerms(e) {
    e.preventDefault();
    e.stopPropagation();
    showTermsError(true);
    terms?.focus({ preventScroll: false });
  }

  // ---------- Events ----------
  // Guard intercept
  guardBtn.addEventListener('click', nudgeToTerms);
  guardBtn.addEventListener('keydown', function (e) {
    const k = e.key || '';
    if (k === 'Enter' || k === ' ') nudgeToTerms(e);
  });

  // Checkbox toggles guard
  terms?.addEventListener('change', () => {
    showTermsError(false);
    syncGuard();
  });

  // Keep overlay aligned on viewport/layout changes
  window.addEventListener('resize', syncGuard, { passive: true });
  window.addEventListener('scroll', syncGuard, { passive: true });

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(syncGuard);
    ro.observe(actions);
    ro.observe(btnAdd);
  }

  // Detect when modal visibility changes (e.g., display:none -> block)
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(() => {
      if (isVisible(root)) {
        requestAnimationFrame(() => {
          syncGuard();
          setTimeout(syncGuard, 50);
          setTimeout(syncGuard, 200);
        });
      }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  // If there's an opener button, resync after click
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t) return;
    if (t.id === 'openCustomization' || t.closest?.('#openCustomization')) {
      // Initialise Uploadery when opening the modal.  This moves the
      // Uploadery field from its hidden container into the modal and
      // associates it with the add-to-cart form.  It must run before
      // syncing the guard overlay.
      initUploaderyField();
      setTimeout(() => {
        syncGuard();
        setTimeout(syncGuard, 60);
      }, 0);
    }
  }, true);

  // Close modal
  btnClose?.addEventListener('click', () => { root.style.display = 'none'; });

  // Reset → defaults + re-enable guard
  btnReset?.addEventListener('click', function () {
    // Clear text inputs
    [titleInput, nameInput].forEach(el => {
      if (el) {
        el.value = '';
        // Trigger input event to update preview
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    // Clear file input
    if (fileInput) {
      fileInput.value = '';
    }
    // Reset radio groups to their first option
    ['placement_name', 'placement_logo', 'color_name', 'font_name'].forEach(name => {
      const radios = root.querySelectorAll('input[name="' + name + '"]');
      if (radios.length) {
        radios.forEach((r, i) => { r.checked = (i === 0); });
      }
    });
    // Reset type to name by checking the first type radio
    if (typeRadios && typeRadios.length) {
      typeRadios.forEach((r, i) => { r.checked = (i === 0); });
    }
    // Uncheck terms
    if (terms) terms.checked = false;
    showTermsError(false);
    // Toggle forms and update preview/add state
    toggleForms();
    updatePreview();
    updateAddState();
  });

  // Apply customisation (only when guard hidden).  This handler
  // collects all of the user’s input, writes the summary, updates the
  // hidden line‑item properties and attaches them to the add‑to‑cart
  // forms.  It supports both "name" and "logo" customisations.  The
  // selected type determines which fields are required and what is
  // populated.  The price for the customisation is drawn from the
  // metafields via nameFee and logoFee.
  btnAdd?.addEventListener('click', async function () {
    // Ensure terms have been agreed; guard overlay should prevent this
    // from firing when unchecked, but double check.
    if (!terms?.checked) {
      showTermsError(true);
      terms?.focus({ preventScroll: false });
      return;
    }
    const type = getType();
    // Helper for setting summary text
    const S = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
    // Helper for setting hidden property values
    const H = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    // Prepare values for name and logo sections depending on the type
    // Name section variables
    let placementName = '';
    let colourName    = '';
    let fontName      = '';
    let titleVal      = '';
    let nameVal       = '';
    // Logo section variables
    let placementLogo = '';
    let fileName      = '';
    let logoUrl       = '';
    let price         = 0;

    if (type === 'name') {
      placementName = getSelected('placement_name');
      colourName    = getSelected('color_name');
      fontName      = getSelected('font_name');
      titleVal      = (titleInput?.value || '').trim();
      nameVal       = (nameInput?.value  || '').trim();
      price         = nameFee;
    } else if (type === 'logo') {
      placementLogo = getSelected('placement_logo');
      price         = logoFee;
      const details = getUploaderyFileDetails();
      fileName      = details.fileName;
      logoUrl       = details.fileUrl;
    } else if (type === 'both') {
      // Gather both sets of inputs
      placementName = getSelected('placement_name');
      colourName    = getSelected('color_name');
      fontName      = getSelected('font_name');
      titleVal      = (titleInput?.value || '').trim();
      nameVal       = (nameInput?.value  || '').trim();
      placementLogo = getSelected('placement_logo');
      // Price is the combined fee
      price         = bothFee;
      const details = getUploaderyFileDetails();
      fileName      = details.fileName;
      logoUrl       = details.fileUrl;
    }

    // Always call finalize synchronously after data is ready.
    finalize();

    function finalize() {
      // Determine type label for summary
      let typeLabel = '';
      if (type === 'logo') typeLabel = 'Logo';
      else if (type === 'both') typeLabel = 'Both';
      else typeLabel = 'Name';
      S('summaryType', typeLabel);
      // Show/hide summary sections and set values
      const liTitle = document.getElementById('liTitle');
      const liName  = document.getElementById('liName');
      const liFile  = document.getElementById('liFile');
      // Reset display for list items
      if (liTitle) liTitle.style.display = 'none';
      if (liName)  liName.style.display  = 'none';
      if (liFile)  liFile.style.display  = 'none';
      // Name section
      if (type === 'name' || type === 'both') {
        if (liTitle) liTitle.style.display = titleVal ? '' : 'none';
        if (liName)  liName.style.display  = nameVal  ? '' : 'none';
        S('summaryTitle', titleVal);
        S('summaryName',  nameVal);
        S('summaryPlacementName', placementName);
        S('summaryFont', fontName);
        S('summaryColorName', colourName);
      }
      // Logo section
      if (type === 'logo' || type === 'both') {
        if (liFile) liFile.style.display = fileName ? '' : 'none';
        S('summaryFileName', fileName);
        S('summaryPlacementLogo', placementLogo);
      }
      // Common placement and colour (legacy fields) use combined or name placement if available
      // For backward compatibility we set summaryPlacement and summaryColor for themes that only show single values
      const commonPlacement = placementName || placementLogo;
      const commonColour    = colourName;
      S('summaryPlacement', commonPlacement);
      S('summaryColor',     commonColour);
      // Font list item display: only for name or both when font present
      const fontLi = document.getElementById('liFont');
      if (fontLi) {
        fontLi.style.display = ( (type === 'name' || type === 'both') && fontName ) ? '' : 'none';
      }
      // Update price breakdown
      const basePriceEl = document.getElementById('baseProductPrice');
      let basePriceCents = 0;
      if (basePriceEl) {
        const p = parseInt(basePriceEl.dataset.productPrice || basePriceEl.getAttribute('data-product-price'));
        basePriceCents = isNaN(p) ? 0 : p;
      }
      const embroideryCents = Math.round(price * 100);
      const formatMoney = (cents) => {
        return (typeof Shopify !== 'undefined' && Shopify.formatMoney) ? Shopify.formatMoney(cents, Shopify.money_format || '${{amount}}') : ('$' + (cents / 100).toFixed(2));
      };
      const embroideryStr = formatMoney(embroideryCents);
      const totalStr      = formatMoney(basePriceCents + embroideryCents);
      const embroideryPriceEl = document.getElementById('embroideryPrice');
      if (embroideryPriceEl) embroideryPriceEl.textContent = embroideryStr;
      const totalPriceEl = document.getElementById('totalPrice');
      if (totalPriceEl) totalPriceEl.textContent = totalStr;
      // Hidden inputs
      H('embTypeInput', typeLabel);
      // Legacy placement/color
      H('placementInput', commonPlacement);
      H('fontInput', fontName);
      // Always set separate placement and colour inputs for name and logo
      H('placementNameInput', placementName);
      H('placementLogoInput', placementLogo);
      H('colorNameInput', colourName);
      // Title and name values
      H('titleInput', titleVal);
      H('nameInput',  nameVal);
      // Colour (legacy) is commonColour
      H('colorInput', commonColour);
      // Logo file
      H('logoFileInput', fileName);
      H('logoUrlInput',  logoUrl);
      // Price
      H('feeInput', price);
      // Show summary
      const sum = document.getElementById('customSummary');
      if (sum) sum.style.display = 'block';
      // Keep open button visible for additional customisations
      const openBtn = document.getElementById('openCustomization');
      if (openBtn) {
        const lbl = openBtn.querySelector('.btn-label');
        if (lbl) lbl.textContent = 'Add embroidery';
        openBtn.style.display = '';
      }
      // Dispatch event with detailed fields for summary
      document.dispatchEvent(new CustomEvent('so:embroidery:apply', {
        detail: {
          type: type,
          placement: commonPlacement,
          font: fontName,
          colour: commonColour,
          title: titleVal,
          name: nameVal,
          fileName: fileName,
          fileUrl: logoUrl,
          price: price,
          // Additional fields for both type
          placementName: placementName,
          placementLogo: placementLogo,
          colourName: colourName,
          fontName: fontName
        }
      }));
      // Build property fields list, including separate placement/colour fields
      try {
        const propertyFields = [
          { name: 'Embroidery', value: 'Yes' },
          { name: 'Embroidery Type', id: 'embTypeInput' },
          { name: 'Embroidery Title', id: 'titleInput' },
          { name: 'Embroidery Name', id: 'nameInput' },
          { name: 'Embroidery Placement', id: 'placementInput' },
          { name: 'Embroidery Font', id: 'fontInput' },
          { name: 'Embroidery Color', id: 'colorInput' },
          { name: 'Embroidery Logo File', id: 'logoFileInput' },
          { name: 'Embroidery Logo URL', id: 'logoUrlInput' },
          { name: 'Embroidery Placement Name', id: 'placementNameInput' },
          { name: 'Embroidery Placement Logo', id: 'placementLogoInput' },
          { name: 'Embroidery Color Name', id: 'colorNameInput' },
          { name: 'Embroidery Price', id: 'feeInput' },
          { name: 'Embroidery Instance', value: String(Date.now()) }
        ];
        const forms = Array.from(document.querySelectorAll('form[action*="/cart/add"]'));
        forms.forEach(function(form) {
          propertyFields.forEach(function(field) {
            let val = '';
            if (Object.prototype.hasOwnProperty.call(field, 'id')) {
              const srcInput = document.getElementById(field.id);
              val = srcInput ? srcInput.value : '';
            } else {
              val = field.value || '';
            }
            const selector = `input[name="properties[${field.name}]\"]`;
            let hidden = form.querySelector(selector);
            if (val === '' || val == null) {
              if (hidden) hidden.remove();
              return;
            }
            if (hidden) {
              hidden.value = val;
            } else {
              hidden = document.createElement('input');
              hidden.type = 'hidden';
              hidden.name = `properties[${field.name}]`;
              hidden.value = val;
              form.appendChild(hidden);
            }
          });
        });
      } catch (e) {
        console.error('Failed to attach embroidery properties to form', e);
      }
      // Reset forms for new customisation
      clearNameFields();
      clearLogoFields();
      if (terms) terms.checked = false;
      currentType = '';
      toggleForms();
      updatePreview();
      updateTypeLabel();
      updateTypePillStyles();
      updateAddState();
      // Close modal
      root.style.display = 'none';
    }
  });

  // ---------- Live counters (optional UX retained) ----------
  [
    ['nameLine1', 'name1Count']
    ].forEach(([inputId, counterId]) => {
    const inputEl   = document.getElementById(inputId);
    const counterEl = document.getElementById(counterId);
    if (!inputEl || !counterEl) return;
    const update = () => { counterEl.textContent = inputEl.value.length; };
    inputEl.addEventListener('input', update);
    update();
  });

  // ---------- Initial sync ----------
  requestAnimationFrame(() => {
    syncGuard();
    setTimeout(syncGuard, 50);
    setTimeout(syncGuard, 200);
  });

  // ---------------------------------------------------------------------------
  // Uploadery: listen for file upload completion events.  When the Uploadery
  // app signals that a file has been uploaded, immediately refresh the logo
  // preview and reevaluate whether the Add button should be enabled.  This
  // prevents the user from needing to click elsewhere before the logo
  // appears in the preview.
  document.addEventListener('uploadery:fileUploaded', function(e) {
    try {
      updateLogoPreview();
      updateAddState();
    } catch (err) {
      console.error('Error handling Uploadery upload event', err);
    }
  });

  // ---------------------------------------------------------------------------
  // Ensure the embroidery preview stays aligned with the product image when
  // the viewport or popup size changes.  Recalculate positions on resize.
  window.addEventListener('resize', function () {
    try {
      updatePreview();
      updateLogoPreview();
    } catch (err) {
      console.error('Error updating preview on resize', err);
    }
  });

  // ---------------------------------------------------------------------------
  // Cleanup after add-to-cart
  // ---------------------------------------------------------------------------
  /**
   * When the customer submits an add-to-cart form (action containing '/cart/add'),
   * remove the existing summary section and any hidden embroidery property
   * inputs from that form.  This ensures the next customisation starts clean
   * and prevents leftover properties from being reused, which can cause
   * “items became unavailable” errors when adding multiple embroidered
   * products.  We listen on the capturing phase to intercept before
   * Shopify’s AJAX cart handler runs.
   */
  document.addEventListener('submit', function handleAddToCart(e) {
    const form = e.target;
    if (!form || !form.matches('form[action*="/cart/add"]')) return;
    try {
      // Hide or remove the summary so the customer can build a new embroidery
      const sum = document.getElementById('customSummary');
      if (sum) {
        // Hide the summary element.  We do not remove it from the DOM so
        // that a subsequent customisation can reuse it.
        sum.style.display = 'none';
      }
      // Remove any hidden embroidery property inputs from this form
      const inputs = form.querySelectorAll('input[name^="properties[Embroidery"]');
      inputs.forEach(function(input) {
        input.parentNode && input.parentNode.removeChild(input);
      });
    } catch (ex) {
      console.error('Error cleaning up embroidery properties', ex);
    }
  }, true);
})();