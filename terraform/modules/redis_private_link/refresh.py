import os
import socket

import boto3

elbv2 = boto3.client("elbv2")


def handler(event, context):
    target_group_arn = os.environ["TARGET_GROUP_ARN"]
    host = os.environ["REDIS_HOST"]
    port = int(os.environ["REDIS_PORT"])

    resolved = {
        info[4][0] for info in socket.getaddrinfo(host, port, socket.AF_INET)
    }
    descriptions = elbv2.describe_target_health(TargetGroupArn=target_group_arn)
    registered = {
        description["Target"]["Id"]
        for description in descriptions["TargetHealthDescriptions"]
    }

    to_register = resolved - registered
    to_deregister = registered - resolved
    if to_register:
        elbv2.register_targets(
            TargetGroupArn=target_group_arn,
            Targets=[{"Id": ip, "Port": port} for ip in sorted(to_register)],
        )
    if to_deregister:
        elbv2.deregister_targets(
            TargetGroupArn=target_group_arn,
            Targets=[{"Id": ip, "Port": port} for ip in sorted(to_deregister)],
        )

    return {
        "resolved": sorted(resolved),
        "registered": sorted(to_register),
        "deregistered": sorted(to_deregister),
    }
