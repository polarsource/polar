class OpenCollectiveService:
    def create_dashboard_link(self, slug: str) -> str:
        return f"https://opencollective.com/{slug}"


open_collective = OpenCollectiveService()
