PYTHON ?= python
MKDOCS ?= $(PYTHON) -m mkdocs

.PHONY: export validate release clean clean-exports serve docs-build docs-deploy

export:
	@./scripts/export.sh

validate:
	@./scripts/validate-exports.sh

release:
	@./scripts/release.sh

serve:
	@$(MKDOCS) serve

docs-build:
	@$(MKDOCS) build --strict

docs-deploy:
	@echo "WARNING: GitHub Pages may expose this documentation publicly depending on repository, account, organization, and Pages settings."
	@echo "Deploy only after church leadership is comfortable with the content and exposure risk."
	@if [ "$$PUBLISH_DOCS_SITE" != "yes" ]; then echo "To deploy intentionally, run: PUBLISH_DOCS_SITE=yes make docs-deploy"; exit 1; fi
	@$(MKDOCS) gh-deploy --force

clean clean-exports:
	@rm -f dist/exports/*.pdf dist/exports/*.docx dist/exports/*.pptx
