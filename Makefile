PYTHON ?= python
MKDOCS ?= $(PYTHON) -m mkdocs

.PHONY: export validate release notebooklm audiobook audiobook-chunks tts-local tts-local-sample tts-local-download-voice audit-public audit-docs clean clean-exports serve docs-build docs-deploy

export:
	@./scripts/export.sh

validate:
	@./scripts/validate-exports.sh

release:
	@./scripts/release.sh

notebooklm:
	@$(PYTHON) scripts/build_notebooklm_bundle.py

audiobook:
	@$(PYTHON) scripts/build_audiobook_bundle.py

audiobook-chunks:
	@$(PYTHON) scripts/build_audiobook_bundle.py

tts-local-download-voice:
	@$(PYTHON) scripts/run_piper_tts.py --download-voice --no-audio

tts-local-sample:
	@$(PYTHON) scripts/run_piper_tts.py --sample

tts-local:
	@$(PYTHON) scripts/run_piper_tts.py

audit-public:
	@$(PYTHON) scripts/audit_public_content.py

audit-docs:
	@$(PYTHON) scripts/audit_document_consistency.py

serve:
	@$(MKDOCS) serve

docs-build: audit-docs
	@$(MKDOCS) build --strict

docs-deploy:
	@echo "WARNING: GitHub Pages may expose this documentation publicly depending on repository, account, organization, and Pages settings."
	@echo "This repo uses the GitHub Actions workflow named 'Deploy Docs Site to GitHub Pages' as the normal deploy path."
	@echo "To publish: push changes to main, open GitHub Actions, run that workflow, and type DEPLOY."
	@echo "Local mkdocs gh-deploy is intentionally not used here."

clean clean-exports:
	@rm -f dist/exports/*.pdf dist/exports/*.docx dist/exports/*.pptx
