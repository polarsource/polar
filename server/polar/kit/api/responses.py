from typing import Any, Dict, Union

from starlette.exceptions import HTTPException


def get_api_errors(*additional_responses) -> Dict[Union[int, str], Dict[str, Any]]:
    """Adds additional responses to swagger schema
    https://fastapi.tiangolo.com/advanced/additional-responses/?h=responses

    ```
    get_api_errors(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        (status.HTTP_404_NOT_FOUND, "Project or member not found"),
    )
    ```
    """
    responses = {}
    for resp in additional_responses:
        response = dict(model=HTTPException)
        status_code = resp

        if isinstance(resp, tuple):
            status_code, description = resp
            response["description"] = description

        responses[status_code] = response

    return responses
