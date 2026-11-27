import json
import os
import re
import urllib.request

import boto3

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])

ACCOUNT_ID_RE = re.compile(r":\d{12}:")
ENV_PREFIX_RE = re.compile(r"\bpolar-(?:production|sandbox|test)-")


def post_to_slack(text):
    request = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=json.dumps({"channel": os.environ["SLACK_CHANNEL"], "text": text}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ['SLACK_BOT_TOKEN']}",
        },
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        body = json.load(response)
    if not body.get("ok"):
        raise RuntimeError(f"Slack postMessage failed: {body.get('error')}")


def normalize_resource_name(value):
    value = ACCOUNT_ID_RE.sub(":*:", value)
    return ENV_PREFIX_RE.sub("polar-", value)


def dedup_key(finding):
    vulnerability_id = finding.get("packageVulnerabilityDetails", {}).get(
        "vulnerabilityId"
    )
    if vulnerability_id is None:
        return finding["findingArn"]
    resource = finding["resources"][0]
    name = resource.get("tags", {}).get("Name")
    if resource["type"] == "AWS_EC2_INSTANCE" and name:
        return f"{vulnerability_id}#{normalize_resource_name(name)}"
    resource_id = normalize_resource_name(resource["id"].split("/sha256:")[0])
    return f"{vulnerability_id}#{resource_id}"


def handler(event, context):
    finding = event["detail"]
    key = dedup_key(finding)
    try:
        table.put_item(
            Item={"key": key},
            ConditionExpression="attribute_not_exists(#key)",
            ExpressionAttributeNames={"#key": "key"},
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        return

    region = event["region"]
    try:
        post_to_slack(
            f":shield: *Inspector {finding['severity']}* in account {finding['awsAccountId']} ({region}): {finding['title']}\n"
            f"Resource: `{finding['resources'][0]['id']}`\n"
            f"https://{region}.console.aws.amazon.com/inspector/v2/home?region={region}#/findings/all"
        )
    except Exception:
        table.delete_item(Key={"key": key})
        raise
