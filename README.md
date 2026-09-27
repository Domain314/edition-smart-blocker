# derStandard Firefox add-ons

Small Firefox extensions for `derstandard.at`:

- `edition-smart-blocker` hides Edition Smart paywall articles.
- `edition-smart-marker` marks Edition Smart paywall articles.
- `derstandard-autoplay-stopper` prevents derStandard's Dailymotion embeds and
  native media from starting without a tap. Dailymotion embeds are replaced by
  their thumbnail; clicking it opens the video on Dailymotion in a new tab.

## Loading the autoplay stopper for development

On Firefox Desktop, open `about:debugging#/runtime/this-firefox`, choose
**Load Temporary Add-on**, and select
`derstandard-autoplay-stopper/manifest.json`.

The packaged file is `derstandard-autoplay-stopper/Archive.zip`. A permanent
Firefox or Firefox for Android installation requires the package to be signed by
Mozilla first.
