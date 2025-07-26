if (!customElements.get('dc-video-features')) {
	customElements.define(
		'dc-video-features',
		class DCVideoFeatures extends HTMLElement {
			constructor() {
				super()
			}

			connectedCallback() {
				this.setupCarousel()
			}

			setupCarousel() {
				const carousel = this.querySelector('[data-carousel]')
				if (!carousel || !window.Flickity) return

				this.carouselFlickity = new window.Flickity(carousel, {
					contain: true,
					pageDots: false,
				})
			}
		}
	)
}

if (!customElements.get('dc-video')) {
	customElements.define(
		'dc-video',
		class DCVideo extends HTMLElement {
			constructor() {
				super()
			}

			connectedCallback() {
				// Auto load content
				new IntersectionObserver(this.loadMedia.bind(this), { rootMargin: '0px 0px 400px 0px' }).observe(this)

				// Setup click to open modal
				const matchModal = document.getElementById(`VideoModal-${this.dataset.modalId}`)

				if (matchModal) {
					this.addEventListener('click', (event) => {
						event.preventDefault()

						requestAnimationFrame(() => {
							matchModal.classList.remove('hidden')
						})

						matchModal.classList.add('is-open')

						matchModal?.loadContent?.()
					})
				}
			}

			loadMedia() {
				if (!this.getAttribute('loaded')) {
					this.mediaContent = document.createElement('div')
					this.mediaContent.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true))

					this.setAttribute('loaded', true)
					const deferredElement = this.appendChild(this.mediaContent.querySelector('video, model-viewer, iframe'))
					if (focus) deferredElement.focus()

					if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
						deferredElement.play()
					}
				}
			}

			openMediaModal() {}
		}
	)
}

if (!customElements.get('dc-video-modal')) {
	customElements.define(
		'dc-video-modal',
		class DCVideoModal extends HTMLElement {
			constructor() {
				super()

				this.closeModal()
			}

			closeModal() {
				this.closeButton = this.querySelector('[data-close]')

				this.closeButton?.addEventListener('click', () => {
					// Hide media
					this.querySelectorAll('video').forEach((video) => video.pause())

					// Hide modal
					this.classList.remove('is-open')

					window.debounce(() => {
						this.classList.add('hidden')
					})()
				})
			}

			loadContent() {
				if (!this.getAttribute('loaded')) {
					this.mediaContent = document.createElement('div')
					this.mediaContent.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true))

					this.setAttribute('loaded', true)
					const deferredElement = this.appendChild(this.mediaContent.querySelector('video, model-viewer, iframe'))
					if (focus) deferredElement.focus()

					if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
						deferredElement.play()
					}
				} else {
					this.querySelectorAll('video').forEach((video) => video.play())
				}
			}
		}
	)
}

