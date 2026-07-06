.PHONY: export validate release clean clean-exports

export:
	@./scripts/export.sh

validate:
	@./scripts/validate-exports.sh

release:
	@./scripts/release.sh

clean clean-exports:
	@rm -f dist/exports/*.pdf dist/exports/*.docx dist/exports/*.pptx
