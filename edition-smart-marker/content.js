function markEditionSmart() {

	function markArticleForLabel(label) {
		const article = label.closest('article');
		if (article) article.style.border = '2px solid #8000ff';
		if (article) article.style.borderRadius = '10px';
		if (article) article.style.backgroundColor = 'rgba(128, 0, 255, 0.1)';
	}

	function scan(root = document) {
		root.querySelectorAll?.('.smart-label').forEach(markArticleForLabel);

		if (root instanceof Element && root.matches('.smart-label')) {
			markArticleForLabel(root);
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
				markArticleForLabel(mutation.target);
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

markEditionSmart();