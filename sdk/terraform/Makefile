default: build

build:
	go build -v ./...

install: build
	go install -v ./...

fmt:
	gofmt -w .

lint:
	go vet ./...
	test -z "$$(gofmt -l .)"

test:
	go test -v ./...

# Acceptance tests run real create/read/update/destroy cycles against a live
# Polar environment. Point them at a dedicated sandbox organization:
#   POLAR_ACCESS_TOKEN=polar_oat_... POLAR_SERVER=sandbox make testacc
# or at a local development stack:
#   POLAR_ACCESS_TOKEN=... POLAR_BASE_URL=http://127.0.0.1:8000 make testacc
testacc:
	TF_ACC=1 go test -v -timeout 30m ./...

# docs/ is hand-maintained for now: tfplugindocs would regenerate it from the
# provider schema and drop the hand-written sections (Import, lifecycle notes).
# Once templates/ carries those sections, switch to generation and remove this
# guard. Requires the terraform CLI and tfplugindocs.
docs:
	@echo "docs/ is hand-maintained; run 'make docs-force' to overwrite it with tfplugindocs output." && exit 1

docs-force:
	tfplugindocs generate

.PHONY: default build install fmt lint test testacc docs docs-force
