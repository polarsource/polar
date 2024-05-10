# File Service

Storing, managing and accessing files on AWS S3. Currently for our hosted
downloads benefit.


### Development Configuration (Optional)

1. Create an AWS account

#### 2. Create S3 Bucket

- Block all public access (secure default)
- Configure CORS (see below)

**CORS Configuration**
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://127.0.0.1:3000"
        ],
        "ExposeHeaders": []
    }
]
```

#### 3. Create IAM User & Policy

**Policy**

We need to create an IAM Policy to attach to the S3 bucket. Below is the JSON
configuration.

Name: Use the same name as the S3 bucket

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": "s3:PutObject",
			"Resource": "arn:aws:s3:::<S3_BUCKET_NAME>/*"
		}
	]
}
```

**User**

We also need to create an IAM User.

- Name: Use the same name as the S3 bucket
- Policy: Choose to attach the policy created above
- Credentials: Upon creating the user goto `Security credentials` and scroll
down to `Access keys` to generate them

#### 4. Configure Polar settings

Update your `.env` for the `POLAR_AWS_*` settings to contain the credentials,
bucket name etc from above.
