// Find the page elements used by the app
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const dateForm = document.getElementById('dateForm');
const gallery = document.getElementById('gallery');
const galleryStatus = document.getElementById('galleryStatus');
const submitButton = dateForm.querySelector('button');
const photoModal = document.getElementById('photoModal');
const closeModalButton = document.getElementById('closeModal');
const modalImage = document.getElementById('modalImage');
const modalDate = document.getElementById('modalDate');
const modalTitle = document.getElementById('modalTitle');
const modalExplanation = document.getElementById('modalExplanation');

const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const apiKey = 'DEMO_KEY';
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const spaceFacts = [
	'A day on Venus is longer than its year.',
	'Neutron stars can spin hundreds of times every second.',
	'The footprints left on the Moon can last for millions of years.',
	'Saturn would float in water because its average density is lower than water.',
	'Sunlight takes about eight minutes to reach Earth.'
];

// Set up the date pickers with NASA's valid date range and a 9-day default.
setupDateInputs(startInput, endInput);

const latestEndDate = new Date(`${endInput.max}T00:00:00Z`);
latestEndDate.setUTCDate(latestEndDate.getUTCDate() - 1);
endInput.max = latestEndDate.toISOString().slice(0, 10);
const latestStartDate = new Date(latestEndDate);
latestStartDate.setUTCDate(latestStartDate.getUTCDate() - 8);
startInput.max = latestStartDate.toISOString().slice(0, 10);
startInput.value = startInput.max;
endInput.value = endInput.max;

const earliestEndDate = new Date(`${startInput.min}T00:00:00Z`);
earliestEndDate.setUTCDate(earliestEndDate.getUTCDate() + 8);
endInput.min = earliestEndDate.toISOString().slice(0, 10);

// Keep the selected dates exactly 9 days apart in either direction.
startInput.addEventListener('change', () => {
	const endDate = new Date(`${startInput.value}T00:00:00Z`);
	endDate.setUTCDate(endDate.getUTCDate() + 8);
	endInput.value = endDate.toISOString().slice(0, 10);
});

endInput.addEventListener('change', () => {
	const startDate = new Date(`${endInput.value}T00:00:00Z`);
	startDate.setUTCDate(startDate.getUTCDate() - 8);
	startInput.value = startDate.toISOString().slice(0, 10);
});

// Choose a different space fact whenever the page loads.
const randomFact = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];
document.getElementById('spaceFact').textContent = randomFact;

function escapeHTML(value) {
	return String(value ?? '').replace(/[&<>"']/g, (character) => {
		const charactersToEscape = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		};
		return charactersToEscape[character];
	});
}

function getSafeUrl(value) {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url.href : '';
	} catch {
		return '';
	}
}

function formatDate(date) {
	return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

function getPlainText(html) {
	return new DOMParser().parseFromString(html || '', 'text/html').body.textContent.trim();
}

function updateGalleryStatus(message, state = '') {
	galleryStatus.textContent = message;
	galleryStatus.className = `gallery-status ${state}`.trim();
}

function displayGallery(entries) {
	const sortedEntries = entries.sort((firstEntry, secondEntry) =>
		secondEntry.date.localeCompare(firstEntry.date)
	);

	gallery.innerHTML = sortedEntries.map((entry, index) => {
		const title = escapeHTML(entry.title || 'Untitled NASA entry');
		const date = escapeHTML(entry.date || '');
		const imageUrl = getSafeUrl(entry.hdurl);
		const previewUrl = getSafeUrl(
			entry.media_type === 'video' ? entry.hdurl || entry.thumbnail_url : entry.hdurl
		);
		const videoUrl = getSafeUrl(entry.permalink || entry.url);

		const media = entry.media_type === 'video'
			? `<a class="video-preview" href="${videoUrl}" target="_blank" rel="noopener noreferrer" aria-label="Watch video: ${title}">
					${previewUrl ? `<img src="${previewUrl}" alt="" loading="lazy" />` : '<span class="video-placeholder">NASA video</span>'}
					<span class="video-label">Watch video <span aria-hidden="true">&#8599;</span></span>
				</a>`
			: imageUrl
				? `<button class="gallery-image-button" type="button" data-image-index="${index}" aria-label="View details for ${title}">
						<img src="${previewUrl || imageUrl}" alt="${title}" loading="lazy" />
					</button>`
				: '<div class="video-placeholder">Image unavailable</div>';

		return `<article class="gallery-item">
			${media}
			<div class="gallery-item-details">
				<time datetime="${date}">${formatDate(entry.date)}</time>
				<h3>${title}</h3>
			</div>
		</article>`;
	}).join('');

	// Image buttons open the full-size image and NASA's explanation.
	gallery.querySelectorAll('[data-image-index]').forEach((button) => {
		button.addEventListener('click', () => {
			const entry = sortedEntries[Number(button.dataset.imageIndex)];
			modalImage.src = getSafeUrl(entry.hdurl);
			modalImage.alt = entry.title || 'Astronomy picture of the day';
			modalDate.textContent = formatDate(entry.date);
			modalTitle.textContent = entry.title || 'Untitled NASA entry';
			modalExplanation.textContent = getPlainText(entry.explanation) || 'No explanation is available for this image.';
			photoModal.showModal();
		});
	});
}

dateForm.addEventListener('submit', async (event) => {
	event.preventDefault();

	if (!dateForm.reportValidity()) {
		return;
	}

	const startDate = new Date(`${startInput.value}T00:00:00Z`);
	const endDate = new Date(`${endInput.value}T00:00:00Z`);
	const dayCount = Math.round((endDate - startDate) / millisecondsPerDay) + 1;

	if (dayCount !== 9) {
		updateGalleryStatus('Choose exactly 9 consecutive days.', 'error');
		return;
	}

	const query = new URLSearchParams({
		api_key: apiKey,
		start_date: startInput.value,
		end_date: endInput.value
	});

	submitButton.disabled = true;
	submitButton.textContent = 'Fetching space images...';
	gallery.replaceChildren();
	updateGalleryStatus('Loading space photos...');

	try {
		const response = await fetch(`${apiUrl}?${query}`);
		const data = await response.json();

		if (!response.ok || data.error) {
			const apiError = typeof data.error === 'string' ? data.error : data.error?.message;
			throw new Error(apiError || 'NASA could not return those images. Please try again.');
		}

		if (!Array.isArray(data) || data.length === 0) {
			updateGalleryStatus('NASA returned no space images. Please try again later.', 'error');
			return;
		}

		const selectedEntries = data.filter((entry) =>
			entry.date >= startInput.value && entry.date <= endInput.value
		);

		if (selectedEntries.length === 0) {
			updateGalleryStatus('NASA did not include those dates in its recent APOD response. Try a more recent 9-day range.', 'error');
			return;
		}

		displayGallery(selectedEntries);
		if (selectedEntries.length < dayCount) {
			updateGalleryStatus(`NASA returned ${selectedEntries.length} of ${dayCount} APOD entries for those dates.`);
		} else {
			updateGalleryStatus(`${selectedEntries.length} space photos found.`);
		}
	} catch (error) {
		updateGalleryStatus(`Unable to load space images: ${error.message}`, 'error');
	} finally {
		submitButton.disabled = false;
		submitButton.textContent = 'Get Space Images';
	}
});

closeModalButton.addEventListener('click', () => photoModal.close());

photoModal.addEventListener('click', (event) => {
	if (event.target === photoModal) {
		photoModal.close();
	}
});
