.PHONY: export validate clean clean-exports

export:
	@./scripts/export.sh

validate:
	@./scripts/validate-exports.sh

clean clean-exports:
	@rm -f dist/exports/*.pdf dist/exports/*.docx dist/exports/*.pptx
