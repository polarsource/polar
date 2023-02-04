.PHONY: clean shell test db-migrate db-rebuild seed lint

clean:
	@echo 'Deleting .pyc and __pycache__ files'
	$(shell find * -name "*.pyc" -delete)
	$(shell find * -name "__pycache__" -delete)

shell:
	@echo 'Initialize Polar environment (.venv)'
	poetry shell

test:
	@echo 'Running Polar Testing Suite'
	POLAR_ENV=testing poetry run coverage run --source polar -m pytest
	POLAR_ENV=testing poetry run coverage report -m

db-migrate:
	@echo 'Upgrading database to HEAD'
	poetry run python -m scripts.db upgrade

db-rebuild:
	@echo 'Dropping database (if exists)'
	poetry run python -m scripts.db recreate
	$(MAKE) seed

seed:
	@echo 'Seeding Polar Database'
	poetry run python -m scripts.db seed

lint:
	pre-commit run --all-files
