.PHONY: export clean-exports

export:
	@./scripts/export.sh

clean-exports:
	@rm -f dist/exports/*.pdf dist/exports/*.docx dist/exports/*.pptx
