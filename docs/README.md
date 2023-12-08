# Docs

Proud users & commercial sponsors of [mkdocs-material](https://github.com/squidfunk/mkdocs-material). We're using the Insiders version in production (hosted by Vercel) to support our blog as well & use additional features - built with sugared features during deployment.

## Local development

Setting up the environment.

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Now we can serve the docs - using port 8080 to avoid collision with Polar API on
otherwise default port 8000.

```
mkdocs serve -a 127.0.0.1:8080
```

Since Insiders is not open source, we cannot have a direct dependency to it in our OSS codebase. However, it is downward compatible to its OSS version which our development (OSS) codebase is dependent on here. See this [discussion](https://github.com/squidfunk/mkdocs-material/discussions/3844) for additional details.

In the rare event you need to develop/customize certain Insiders features of our docs, e.g blog design, you have to manually install the Insiders version locally. In case you're working at Polar, you can simply run:

```
poetry add git+https://github.com/<link_to_our_fork>
```

Thereafter, make sure to serve the docs using the inherited insiders config, e.g

```
mkdocs serve -a 127.0.0.1:8080 -f mkdocs.insiders.yml
```

