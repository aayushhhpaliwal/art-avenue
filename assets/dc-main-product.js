/****************************************************************
 *                      STOCK INFORMATION                       *
 ****************************************************************/
if (!customElements.get('dc-stock-information')) {
	class DCStockInformation extends HTMLElement {
		constructor() {
			super()
		}

		connectedCallback() {
			this.mediumThreshold = parseInt(this.dataset.mediumThreshold)
			this.highThreshold = parseInt(this.dataset.highThreshold)

			const outStockTextDefault = this.dataset.outStockText
			const lowTextDefault = this.dataset.lowText
			const mediumTextDefault = this.dataset.mediumText
			const highTextDefault = this.dataset.highText

			const outStockText = this.querySelector('[data-out-stock-text]')
			const lowStockText = this.querySelector('[data-low-stock-text]')
			const mediumStockText = this.querySelector('[data-medium-stock-text]')
			const highStockText = this.querySelector('[data-high-stock-text]')

			this.getVariantData()

			this.variantChangeUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
				const currentVariant = event.data.variant
				const policyVariant = this.variantData.find((variant) => variant.id == currentVariant.id)
				const variantQty = policyVariant.inventory_quantity
				let status = 'out-stock'

				if (policyVariant.inventory_policy == 'continue') status = 'continue'
				else {
					if (variantQty > 0 && variantQty < this.mediumThreshold) status = 'low'
					else if (variantQty >= this.mediumThreshold && variantQty < this.highThreshold) status = 'medium'
					else if (variantQty >= this.highThreshold) status = 'high'
				}

				outStockText.innerHTML = `${outStockTextDefault}`.replace('[quantity]', variantQty)
				lowStockText.innerHTML = `${lowTextDefault}`.replace('[quantity]', variantQty)
				mediumStockText.innerHTML = `${mediumTextDefault}`.replace('[quantity]', variantQty)
				highStockText.innerHTML = `${highTextDefault}`.replace('[quantity]', variantQty)

				this.classList.remove('low', 'high', 'out-stock', 'medium', 'continue')
				this.classList.add(status)
			})
		}

		disconnectedCallback() {
			this.variantChangeUnsubscriber && this.variantChangeUnsubscriber()
		}

		getVariantData() {
			this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent)

			return this.variantData
		}
	}

	customElements.define('dc-stock-information', DCStockInformation)
}

/****************************************************************
 *                       STICKY CART                            *
 ****************************************************************/
if (!customElements.get('dc-sticky-cart')) {
	class DCStickyCart extends HTMLElement {
		constructor() {
			super()
		}

		connectedCallback() {
			this.sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section
			this.productInfo = document.getElementById(`ProductInfo-${this.sectionId}`)
			this.addToCartButton = document.getElementById(`ProductSubmitButton-${this.sectionId}`)
			this.stickyAddToCart = this.querySelector('[data-addtocart]')
			this.stickyAddToCartText = this.stickyAddToCart.querySelector('span')
			this.stickyAddToCartSpinner = this.stickyAddToCart.querySelector('.loading__spinner')
			this.price = this.querySelector(`#StickyCartPrice-${this.sectionId}`)

			// Setup sticky on change event
			this.productInfo && window.addEventListener('scroll', () => this.onScroll())

			// Catch fake add to cart
			this.stickyAddToCart.addEventListener('click', () => {
				this.stickyAddToCart.classList.add('loading')
				this.stickyAddToCartSpinner.classList.remove('hidden')
			})

			// Catch event variant change -> Update content
			this.variantChangeUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
				const html = event.data.html

				// Update price
				const source = html.getElementById(`price-${this.sectionId}`)

				if (source && this.price) this.price.innerHTML = source.innerHTML

				// Update add-to-cart button
				const addButtonUpdated = html.getElementById(`ProductSubmitButton-${this.sectionId}`)

				this.toggleAddButton(
					addButtonUpdated ? addButtonUpdated.hasAttribute('disabled') : true,
					window.variantStrings.soldOut
				)
			})

			// Catch event cart-update to
			this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, () => {
				this.stickyAddToCart.classList.remove('loading')
				this.stickyAddToCartSpinner.classList.add('hidden')
			})

			this.variantChangeUnsubscriber = publish(PUB_SUB_EVENTS.cartError, () => {
				this.stickyAddToCart.classList.remove('loading')
				this.stickyAddToCartSpinner.classList.add('hidden')
			})
		}

		disconnectedCallback() {
			this.variantChangeUnsubscriber && this.variantChangeUnsubscriber()
			this.cartUpdateUnsubscriber && this.cartUpdateUnsubscriber()
			this.variantChangeUnsubscriber && this.variantChangeUnsubscriber()
		}

		toggleAddButton(disable = true, text) {
			console.log({ disable, text })
			if (disable) {
				this.stickyAddToCart.setAttribute('disabled', 'disabled')
				if (text) this.stickyAddToCartText.textContent = text
			} else {
				this.stickyAddToCart.removeAttribute('disabled')
				this.stickyAddToCartText.textContent = window.variantStrings.addToCart
			}
		}

		onScroll() {
			const isShow = window.scrollY > this.productInfo.getBoundingClientRect().bottom + 200

			isShow ? this.classList.add('is-show') : this.classList.remove('is-show')
		}
	}

	customElements.define('dc-sticky-cart', DCStickyCart)
}

/****************************************************************
 *                       PRODUCT BUNDLES                        *
 ****************************************************************/
class DCBundles extends HTMLElement {
	constructor() {
		super()

		this.addEventListener('change', (event) => {
			const currentVariantId = event.target.value

			this.updateMasterId(currentVariantId)
			this.updateQuantityInputs()
			this.toggleAddButton(true, '', false)
			this.updatePickupAvailability()
			this.removeErrorMessage()

			if (!this.currentVariant) {
				this.toggleAddButton(true, '', true)
				this.setUnavailable()
			} else {
				this.updateURL()
				this.updateVariantInput()
				this.renderProductInfo()
				this.updateShareUrl()
			}
		})
	}

	updateMasterId(currentVariantId) {
		this.currentVariant = this.getVariantData().find((variant) => variant.id == currentVariantId)

		this.options = this.currentVariant.options
	}

	updateQuantityInputs() {
		this.quantityInputs = this.quantityInputs || this.querySelectorAll('[data-variant-input]')

		this.quantityInputs.forEach((quantityInput) => {
			// Set disabled / enabled input
			const variantId = `${quantityInput.dataset.variantInput}`
			quantityInput.disabled = variantId != this.currentVariant.id
		})
	}

	updateURL() {
		if (!this.currentVariant || this.dataset.updateUrl === 'false') return
		window.history.replaceState({}, '', `${this.dataset.url}?variant=${this.currentVariant.id}`)
	}

	updateShareUrl() {
		const shareButton = document.getElementById(`Share-${this.dataset.section}`)
		if (!shareButton || !shareButton.updateUrl) return
		shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`)
	}

	updateVariantInput() {
		const productForms = document.querySelectorAll(
			`#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
		)
		productForms.forEach((productForm) => {
			const input = productForm.querySelector('input[name="id"]')
			input.value = this.currentVariant.id
			input.dispatchEvent(new Event('change', { bubbles: true }))
		})
	}

	setInputAvailability(elementList, availableValuesList) {
		elementList.forEach((element) => {
			const value = element.getAttribute('value')
			const availableElement = availableValuesList.includes(value)

			if (element.tagName === 'INPUT') {
				element.classList.toggle('disabled', !availableElement)
			} else if (element.tagName === 'OPTION') {
				element.innerText = availableElement
					? value
					: window.variantStrings.unavailable_with_option.replace('[value]', value)
			}
		})
	}

	updatePickupAvailability() {
		const pickUpAvailability = document.querySelector('pickup-availability')
		if (!pickUpAvailability) return

		if (this.currentVariant && this.currentVariant.available) {
			pickUpAvailability.fetchAvailability(this.currentVariant.id)
		} else {
			pickUpAvailability.removeAttribute('available')
			pickUpAvailability.innerHTML = ''
		}
	}

	removeErrorMessage() {
		const section = this.closest('section')
		if (!section) return

		const productForm = section.querySelector('product-form')
		if (productForm) productForm.handleErrorMessage()
	}

	updateMedia(html) {
		const mediaGallerySource = document.querySelector(`[id^="MediaGallery-${this.dataset.section}"] ul`)
		const mediaGalleryDestination = html.querySelector(`[id^="MediaGallery-${this.dataset.section}"] ul`)

		const refreshSourceData = () => {
			const mediaGallerySourceItems = Array.from(mediaGallerySource.querySelectorAll('li[data-media-id]'))
			const sourceSet = new Set(mediaGallerySourceItems.map((item) => item.dataset.mediaId))
			const sourceMap = new Map(mediaGallerySourceItems.map((item, index) => [item.dataset.mediaId, { item, index }]))

			return [mediaGallerySourceItems, sourceSet, sourceMap]
		}

		if (mediaGallerySource && mediaGalleryDestination) {
			let [mediaGallerySourceItems, sourceSet, sourceMap] = refreshSourceData()
			const mediaGalleryDestinationItems = Array.from(mediaGalleryDestination.querySelectorAll('li[data-media-id]'))
			const destinationSet = new Set(mediaGalleryDestinationItems.map(({ dataset }) => dataset.mediaId))
			let shouldRefresh = false

			// add items from new data not present in DOM
			for (let i = mediaGalleryDestinationItems.length - 1; i >= 0; i--) {
				if (!sourceSet.has(mediaGalleryDestinationItems[i].dataset.mediaId)) {
					mediaGallerySource.prepend(mediaGalleryDestinationItems[i])
					shouldRefresh = true
				}
			}

			// remove items from DOM not present in new data
			for (let i = 0; i < mediaGallerySourceItems.length; i++) {
				if (!destinationSet.has(mediaGallerySourceItems[i].dataset.mediaId)) {
					mediaGallerySourceItems[i].remove()
					shouldRefresh = true
				}
			}

			// refresh
			if (shouldRefresh) [mediaGallerySourceItems, sourceSet, sourceMap] = refreshSourceData()

			// if media galleries don't match, sort to match new data order
			mediaGalleryDestinationItems.forEach((destinationItem, destinationIndex) => {
				const sourceData = sourceMap.get(destinationItem.dataset.mediaId)

				if (sourceData && sourceData.index !== destinationIndex) {
					mediaGallerySource.insertBefore(
						sourceData.item,
						mediaGallerySource.querySelector(`li:nth-of-type(${destinationIndex + 1})`)
					)

					// refresh source now that it has been modified
					;[mediaGallerySourceItems, sourceSet, sourceMap] = refreshSourceData()
				}
			})
		}

		if (this.currentVariant.featured_media) {
			document
				.querySelector(`[id^="MediaGallery-${this.dataset.section}"]`)
				?.setActiveMedia?.(`${this.dataset.section}-${this.currentVariant.featured_media.id}`)
		}

		// update media modal
		const modalContent = document.querySelector(`#ProductModal-${this.dataset.section} .product-media-modal__content`)
		const newModalContent = html.querySelector(`product-modal`)
		if (modalContent && newModalContent) modalContent.innerHTML = newModalContent.innerHTML
	}

	renderProductInfo() {
		const requestedVariantId = this.currentVariant.id
		const sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section

		fetch(
			`${this.dataset.url}?variant=${requestedVariantId}&section_id=${
				this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section
			}`
		)
			.then((response) => response.text())
			.then((responseText) => {
				// prevent unnecessary ui changes from abandoned selections
				if (this.currentVariant.id !== requestedVariantId) return

				const html = new DOMParser().parseFromString(responseText, 'text/html')
				const destination = document.getElementById(`price-${this.dataset.section}`)
				const source = html.getElementById(
					`price-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
				)
				const skuSource = html.getElementById(
					`Sku-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
				)
				const skuDestination = document.getElementById(`Sku-${this.dataset.section}`)
				const inventorySource = html.getElementById(
					`Inventory-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
				)
				const inventoryDestination = document.getElementById(`Inventory-${this.dataset.section}`)

				const volumePricingSource = html.getElementById(
					`Volume-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
				)

				this.updateMedia(html)

				const pricePerItemDestination = document.getElementById(`Price-Per-Item-${this.dataset.section}`)
				const pricePerItemSource = html.getElementById(
					`Price-Per-Item-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
				)

				const volumePricingDestination = document.getElementById(`Volume-${this.dataset.section}`)
				const qtyRules = document.getElementById(`Quantity-Rules-${this.dataset.section}`)
				const volumeNote = document.getElementById(`Volume-Note-${this.dataset.section}`)

				if (volumeNote) volumeNote.classList.remove('hidden')
				if (volumePricingDestination) volumePricingDestination.classList.remove('hidden')
				if (qtyRules) qtyRules.classList.remove('hidden')

				if (source && destination) destination.innerHTML = source.innerHTML
				if (inventorySource && inventoryDestination) inventoryDestination.innerHTML = inventorySource.innerHTML
				if (skuSource && skuDestination) {
					skuDestination.innerHTML = skuSource.innerHTML
					skuDestination.classList.toggle('hidden', skuSource.classList.contains('hidden'))
				}

				if (volumePricingSource && volumePricingDestination) {
					volumePricingDestination.innerHTML = volumePricingSource.innerHTML
				}

				if (pricePerItemSource && pricePerItemDestination) {
					pricePerItemDestination.innerHTML = pricePerItemSource.innerHTML
					pricePerItemDestination.classList.toggle('hidden', pricePerItemSource.classList.contains('hidden'))
				}

				const price = document.getElementById(`price-${this.dataset.section}`)

				if (price) price.classList.remove('hidden')

				if (inventoryDestination) inventoryDestination.classList.toggle('hidden', inventorySource.innerText === '')

				const addButtonUpdated = html.getElementById(`ProductSubmitButton-${sectionId}`)
				this.toggleAddButton(
					addButtonUpdated ? addButtonUpdated.hasAttribute('disabled') : true,
					window.variantStrings.soldOut
				)

				publish(PUB_SUB_EVENTS.variantChange, {
					data: {
						sectionId,
						html,
						variant: this.currentVariant,
					},
				})
			})
	}

	toggleAddButton(disable = true, text, modifyClass = true) {
		const productForm = document.getElementById(`product-form-${this.dataset.section}`)
		if (!productForm) return
		const addButton = productForm.querySelector('[name="add"]')
		const addButtonText = productForm.querySelector('[name="add"] > span')
		if (!addButton) return

		if (disable) {
			addButton.setAttribute('disabled', 'disabled')
			if (text) addButtonText.textContent = text
		} else {
			addButton.removeAttribute('disabled')
			addButtonText.textContent = window.variantStrings.addToCart
		}

		if (!modifyClass) return
	}

	setUnavailable() {
		const button = document.getElementById(`product-form-${this.dataset.section}`)
		const addButton = button.querySelector('[name="add"]')
		const addButtonText = button.querySelector('[name="add"] > span')
		const price = document.getElementById(`price-${this.dataset.section}`)
		const inventory = document.getElementById(`Inventory-${this.dataset.section}`)
		const sku = document.getElementById(`Sku-${this.dataset.section}`)
		const pricePerItem = document.getElementById(`Price-Per-Item-${this.dataset.section}`)
		const volumeNote = document.getElementById(`Volume-Note-${this.dataset.section}`)
		const volumeTable = document.getElementById(`Volume-${this.dataset.section}`)
		const qtyRules = document.getElementById(`Quantity-Rules-${this.dataset.section}`)

		if (!addButton) return
		addButtonText.textContent = window.variantStrings.unavailable
		if (price) price.classList.add('hidden')
		if (inventory) inventory.classList.add('hidden')
		if (sku) sku.classList.add('hidden')
		if (pricePerItem) pricePerItem.classList.add('hidden')
		if (volumeNote) volumeNote.classList.add('hidden')
		if (volumeTable) volumeTable.classList.add('hidden')
		if (qtyRules) qtyRules.classList.add('hidden')
	}

	getVariantData() {
		this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent)

		return this.variantData
	}
}

customElements.define('dc-variant-bundles', DCBundles)

