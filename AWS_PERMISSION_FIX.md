
# 🔐 AWS Permission Fix: "ce:GetCostAndUsage" Access Denied

Your extension is failing to connect because the IAM user `driftguard-bot` does not have permission to access AWS Cost Explorer data.

## ✅ The Quickest Fix (Recommended)

1. Go to the **AWS IAM Console**: [https://console.aws.amazon.com/iam/home#/users](https://console.aws.amazon.com/iam/home#/users)
2. Click on your user: **`driftguard-bot`**
3. Go to the **Permissions** tab.
4. Click **Add permissions** -> **Add permissions**.
5. Select **Attach policies directly**.
6. In the search box, type: **`AWSCostExplorerReadOnlyAccess`**
7. Check the box next to it.
8. Click **Next** -> **Add permissions**.

Wait ~1 minute, then try the "Test Connection" button again in CloudSight.

## 🔒 The Strict Fix (Custom Inline Policy)

If you prefer minimum privilege:

1. Go to your user `driftguard-bot` -> Permissions.
2. Click **Add permissions** -> **Create inline policy**.
3. Use the JSON editor and paste this:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ce:GetCostAndUsage",
                "ce:GetCostForecast",
                "ce:GetDimensionValues",
                "ce:GetTags"
            ],
            "Resource": "*"
        }
    ]
}
```

4. Name it `CloudSightPolicy` and create it.

## ⚠️ Important Note: Root User Access
If you are logged in as the Root User, you must first enable "IAM User and Role Access to Billing Information" in your Account Settings.
1. Go to [Account Settings](https://console.aws.amazon.com/billing/home?#/account).
2. Look for **IAM User and Role Access to Billing Information**.
3. Click **Edit** -> check **Activate IAM Access** -> Update.

Without this step, even Administrator access IAM users cannot see billing data!
