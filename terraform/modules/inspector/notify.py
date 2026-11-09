import json
import os
import urllib.request

import boto3

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


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


def dedup_key(finding):
    vulnerability_id = finding.get("packageVulnerabilityDetails", {}).get(
        "vulnerabilityId"
    )
    if vulnerability_id is None:
        return finding["findingArn"]
    resource = finding["resources"][0]
    name = resource.get("tags", {}).get("Name")
    if resource["type"] == "AWS_EC2_INSTANCE" and name:
        return f"{vulnerability_id}#{finding['awsAccountId']}/{name}"
    return f"{vulnerability_id}#{resource['id'].split('/sha256:')[0]}"


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
