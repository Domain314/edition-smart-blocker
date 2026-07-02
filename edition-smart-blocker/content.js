function blockEditionSmart() {
	function removeArticleForLabel(label) {
		const article = label.closest('article');
		console.log('removing article', article);
		if (article) article.remove();
	}

	function scan(root = document) {
		root.querySelectorAll?.('.smart-label').forEach(removeArticleForLabel);

		if (root instanceof Element && root.matches('.smart-label')) {
			removeArticleForLabel(root);
		}
	}

	scan();

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === 'childList') {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						scan(node);
					}
				});
			}

			if (
				mutation.type === 'attributes' &&
				mutation.attributeName === 'class' &&
				mutation.target.matches?.('.smart-label')
			) {
				removeArticleForLabel(mutation.target);
			}
		}
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class'],
	});
}

blockEditionSmart();