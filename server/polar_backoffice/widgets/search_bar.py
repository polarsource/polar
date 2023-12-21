from textual.app import ComposeResult
from textual.message import Message
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Input


class SearchBar(Widget):
    DEFAULT_CSS = """
    SearchBar {
        display: none;
        dock: bottom;
        height: 1;
    }
    SearchBar.active {
        display: block;
    }

    SearchBar Input {
        border: none;
        height: 1;
    }
    SearchBar Input:focus {
        border: none;
    }
    SearchBar Input.-invalid {
        border: none;
        color: $error;
    }
    SearchBar Input.-invalid:focus {
        border: none;
    }
    """

    class Submitted(Message):
        def __init__(self, query: str) -> None:
            self.query = query
            super().__init__()

    class Cleared(Message):
        pass

    active: reactive[bool] = reactive(False)

    def compose(self) -> ComposeResult:
        yield Input()

    def toggle(self) -> None:
        self.active = not self.active

    def on_input_submitted(self, event: Input.Submitted) -> None:
        self.post_message(self.Submitted(event.value))
        self.toggle()

    def watch_active(self, old_active: bool, new_active: bool) -> None:
        if new_active:
            self.add_class("active")
            self.query_one(Input).focus()
        else:
            self.remove_class("active")

    def key_escape(self) -> None:
        self.post_message(self.Cleared())
        self.query_one(Input).clear()
        self.toggle()
