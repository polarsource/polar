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
# Polar environment, driven by the terraform CLI (which must be on PATH, or
# pointed at with TF_ACC_TERRAFORM_PATH). Point them at a dedicated sandbox
# organization:
#   POLAR_ACCESS_TOKEN=polar_oat_... POLAR_SERVER=sandbox make testacc
# or at a local development stack:
#   POLAR_ACCESS_TOKEN=... POLAR_BASE_URL=http://127.0.0.1:8000 make testacc
# They share one organization and are not parallelized; the whole suite takes
# well under a minute against a local stack.
testacc:
	TF_ACC=1 go test -v -timeout 30m ./...

POLAR_LOCAL_BASE_URL ?= http://127.0.0.1:8000

# testacc-local is testacc against a local development stack, with the access
# token minted for you: organization access tokens can only be created from the
# dashboard, so tools/mint_acceptance_token.py reaches into the server's own
# services instead. Needs the backend running (`cd server && uv run task api`).
testacc-local:
	@curl -fsS $(POLAR_LOCAL_BASE_URL)/healthz > /dev/null || { \
		echo "No Polar API at $(POLAR_LOCAL_BASE_URL). Start one with 'cd server && uv run task api'."; \
		exit 1; \
	}
	POLAR_BASE_URL=$(POLAR_LOCAL_BASE_URL) \
	POLAR_ACCESS_TOKEN="$$(cd ../../server && uv run python ../sdk/terraform/tools/mint_acceptance_token.py)" \
	$(MAKE) testacc

# docs/ is hand-maintained for now: tfplugindocs would regenerate it from the
# provider schema and drop the hand-written sections (Import, lifecycle notes).
# Once templates/ carries those sections, switch to generation and remove this
# guard. Requires the terraform CLI and tfplugindocs.
docs:
	@echo "docs/ is hand-maintained; run 'make docs-force' to overwrite it with tfplugindocs output." && exit 1

docs-force:
	tfplugindocs generate

.PHONY: default build install fmt lint test testacc testacc-local docs docs-force
