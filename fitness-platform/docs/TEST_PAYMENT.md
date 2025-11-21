# Payment System Testing Guide

This guide provides comprehensive steps to test the Gym SaaS Payment System using **HTTPie**. It covers environment setup, webhook configuration, and example commands for all payment endpoints.

## 🔄 Payment Flow Overview

Before testing, it is helpful to understand the complete lifecycle of a payment:

1. **User Selects "Pay"** (Client-Side)
    * **Action**: The user clicks a "Pay Now" button in the frontend application (e.g., after selecting a class to book).
    * **Context**: The frontend gathers necessary details like the `classBookingId` or `serviceId`.

2. **Initialization Request** (`POST /payments/create`)
    * **Action**: The client sends an authenticated request to the backend.
    * **Payload**: Includes `type` (e.g., "BOOKING"), `classBookingId`, and `returnUrl`.
    * **Backend Logic**: The system creates a local `Payment` record with status `PENDING` and generates a unique transaction reference (`txRef`).

3. **Chapa Registration** (External API Call)
    * **Action**: The backend communicates with Chapa's API to register the transaction.
    * **Result**: Chapa returns a `checkoutUrl` where the payment can be processed securely.

4. **Redirection** (Client-Side)
    * **Action**: The backend responds to the client with the `checkoutUrl`. The frontend redirects the user's browser to this URL.

5. **Payment Action** (Chapa Hosted Page)
    * **Action**: The user lands on Chapa's secure payment page.
    * **Interaction**: They choose a payment method (Credit Card, Telebirr, Amole, etc.), enter details, and confirm payment.

6. **Webhook Event** (`POST /payments/webhook`)
    * **Action**: Once payment is successful, Chapa's server sends an asynchronous HTTP POST request to the backend's webhook endpoint.
    * **Security**: The request includes a `x-chapa-signature` header which the backend verifies using the secret key to ensure authenticity.

7. **Fulfillment** (Internal Logic)
    * **Action**: Upon verifying the webhook, the backend updates the `Payment` status from `PENDING` to `PROCESSED`.
    * **Side Effect**: The associated `ClassBooking` or `ServiceBooking` is updated to `CONFIRMED`, and the user is granted access.

## 🛠️ Prerequisites

### 0. Setup Data (One-Time Setup)

Before testing the payment flow, you need to populate the database with a Gym Owner, Gym, Trainer, Class, and Customer.

#### 1. Create Gym Owner

Register a user with the `GYMOWNER` role.

```bash
http POST http://localhost:3000/auth/register \
    Content-Type:application/json \
    <<< '{
  "firstName": "John",
  "lastName": "Doe",
  "userName": "johndoe",
  "password": "password123",
  "birthDate": "1990-01-01T00:00:00.000Z",
  "gender": "MALE",
  "email": "berek.test.123@gmail.com",
  "phoneNo": "1234567890",
  "location": "New York",
  "goal": "WEIGHTLOSS",
  "role": "GYMOWNER"
}'
```

**Action**: Note the `userId` (e.g., `1`).

#### 2. Login as Gym Owner

Get the authentication token.

```bash
http POST http://localhost:3000/auth/login \
    Content-Type:application/json \
    <<< '{
  "email": "berek.test.123@gmail.com",
  "password": "password123"
}'
```

**Action**: Copy the `access_token` and use it as `Bearer <OWNER_TOKEN>`.

#### 3. Create Gym

Create a gym using the Owner's token.

```bash
http POST http://localhost:3000/gyms \
    Authorization:"Bearer <OWNER_TOKEN>" \
    Content-Type:application/json \
    <<< '{
  "gymName": "Awesome Gym",
  "contactNo": "555-1234",
  "location": "San Francisco",
  "workingHours": "6am - 10pm"
}
'
```

**Action**: Note the `gymId` (e.g., `1`).

#### 4. Create Trainer

Register a user with the `TRAINER` role.

```bash
http POST http://localhost:3000/auth/register \
    Content-Type:application/json \
    <<< '{
        "firstName": "John",
        "lastName": "Trainer",
        "userName": "trainer1",
        "email": "trainer@example.com",
        "password": "password123",
        "birthDate": "1990-01-01",
        "gender": "MALE",
        "location": "Addis Ababa",
        "role": "TRAINER"
    }'
```

**Action**: Note the `userId` (e.g., `2`).

#### 5. Create Gym Class

Create a class linked to the Gym and Trainer.

```bash
http POST http://localhost:3000/gym-classes \
    Authorization:"Bearer <OWNER_TOKEN>" \
    Content-Type:application/json \
    <<< '{
"className": "Yoga Class",
"price": 50.0,
"classSchedule": "Mon-Wed 6PM",
"capacity": 20,
"duration": "60 minutes",
"gymId": 11,
"trainerId": 3
}'
```

**Action**: Note the `classId` (e.g., `1`).

#### 6. Create Customer

Register a regular user who will make the payment.

```bash
http POST http://localhost:3000/auth/register \
    Content-Type:application/json \
    <<< '{
        "firstName": "Alice",
        "lastName": "Customer",
        "userName": "alice1",
        "email": "customer@example.com",
        "password": "password123",
        "birthDate": "1995-01-01",
        "gender": "FEMALE",
        "location": "Addis Ababa",
        "role": "CUSTOMER"
    }'
```

#### 7. Create Booking (Prerequisite for Payment)

Login as the customer and create a booking.

```bash
# Login
http POST http://localhost:3000/auth/login \
    Content-Type:application/json \
    <<< '{ "email": "customer@example.com", "password": "password123" }'

# Create Booking (Returns checkoutUrl immediately)
http POST http://localhost:3000/bookings/classes \
    Authorization:"Bearer <CUSTOMER_TOKEN>" \
    Content-Type:application/json \
    <<< '{
  "classId": 21,
  "startTime": "2025-11-15T10:00:00Z",
  "endTime": "2025-11-15T11:00:00Z",
  "notes": "Excited for this class!",
  "returnUrl": "https://www.google.com"
}'
```

**Action**: Note the `classBookingId` (e.g., `1`). You can use the returned `checkoutUrl` directly (proceed to step 3. Complete Payment (Two Scenarios)), or proceed to Step 2. Initialize Payment (Class Booking) to retrieve it again.

### 1. Start the Backend

Ensure your NestJS server is running:

```bash
npm run start:dev
```

### 2. Set up Ngrok (For Webhooks)

To receive payment notifications from Chapa (Webhooks) on your local machine, you need to expose your localhost to the internet.

1. **Install Ngrok**: [Download here](https://ngrok.com/download).
2. **Run Ngrok**:

    ```bash
    ngrok http 3000
    ```

3. **Copy the Forwarding URL**: Look for the line starting with `Forwarding`.
    * Example: `https://a1b2-c3d4.ngrok-free.app`

### 3. Configure Chapa Dashboard

1. Log in to your [Chapa Dashboard](https://dashboard.chapa.co/).
2. Navigate to **Settings** > **Webhooks**.
3. **Webhook URL**: Paste your Ngrok URL appended with `/payments/webhook`.
    * Example: `https://a1b2-c3d4.ngrok-free.app/payments/webhook`
4. **Secret Key**: Ensure the `CHAPA_WEBHOOK_SECRET` in your `.env` file matches the Secret Hash/Key in Chapa settings.

---

## 🧪 Testing Scenarios

### 1. Authenticate (Get Token)

You need a JWT token for most requests. Replace credentials with your test user.

```bash
http POST http://localhost:3000/auth/login \
    Content-Type:application/json \
    <<< '{
        "email": "customer@example.com",
        "password": "password123"
    }'
```

**Action**: Copy the `access_token` from the response. You will use it as `Bearer <TOKEN>` below.

---

### 2. Initialize Payment

This step covers the initialization phase where the user decides to pay, and the system registers the transaction with Chapa.

> **Why use this endpoint?**
>
> * **Retries**: If a user cancels or fails a payment, they can use this endpoint to try again for an existing booking.
> * **Pay Later**: Supports flows where a user books now and pays later.
> * **Testing**: Allows testing payment logic without creating new bookings every time.

**Flow Details:**

1. **User Selects "Pay"** (Client-Side): The user clicks "Pay Now" for a booking.
2. **Initialization Request** (`POST /payments/create`): The client sends details to the backend.
3. **Chapa Registration**: Backend registers with Chapa and gets a `checkoutUrl`.
4. **Redirection**: Backend sends `checkoutUrl` to client for redirection.

#### Option A: Class Booking

* **Prerequisite**: A `ClassBooking` must exist (e.g., ID `1`) and belong to the user.

```bash
http POST http://localhost:3000/payments/create \
    Authorization:"Bearer <TOKEN>" \
    type="BOOKING" \
    classBookingId:=1 \
    returnUrl="https://google.com" \
    metadata:='{"notes": "First session", "promo": "SUMMER2025"}'
```

**Response**:

```json
{
    "txRef": "GYM-1732195...",
    "checkoutUrl": "https://checkout.chapa.co/checkout/payment/..."
}
```

*Alternatively, using explicit JSON body:*

```bash
http POST http://localhost:3000/payments/create \
    Authorization:"Bearer <TOKEN>" \
    Content-Type:application/json \
    <<< '{
        "type": "BOOKING",
        "classBookingId": 1,
        "returnUrl": "https://google.com",
        "metadata": {
            "notes": "First session",
            "promo": "SUMMER2025"
        }
    }'
```

#### Option B: Service Booking

* **Prerequisite**: A `ServiceBooking` must exist (e.g., ID `10`) and belong to the user.

```bash
http POST http://localhost:3000/payments/create \
    Authorization:"Bearer <TOKEN>" \
    type="BOOKING" \
    serviceBookingId:=10 \
    returnUrl="https://google.com"
```

**Response**:

```json
{
    "txRef": "GYM-1732195...",
    "checkoutUrl": "https://checkout.chapa.co/checkout/payment/..."
}
```

**Action**: Open the `checkoutUrl` in your browser and complete the payment using Chapa's test card credentials.

---

### 3. Complete Payment (Two Scenarios)

This step covers the actual payment on Chapa's page and the subsequent webhook processing.

**Flow Details:**

1. **Payment Action** (Chapa Hosted Page): User enters details and confirms payment.
2. **Webhook Event** (`POST /payments/webhook`): Chapa notifies the backend.
3. **Fulfillment**: Backend verifies signature, updates payment to `PROCESSED`, and confirms booking.

Once you have the `checkoutUrl` from Step 2, you have two ways to proceed:

#### Scenario A: Real Payment Flow (Recommended with Ngrok)

*Use this if you have set up Ngrok and configured the Chapa Dashboard.*

1. **Open the URL**: Copy the `checkoutUrl` and paste it into your browser.
2. **Pay**: Use Chapa's test card credentials or test mobile money numbers to complete the payment.

    **Test Credentials:**

    * **Visa Test Card**:
        * Card Number: `4200 0000 0000 0000`
        * CVV: `123`
        * Expiry: `12/34`
        * [More Test Cards](http://developer.chapa.co/test/testing-cards)

    * **Mobile Money (Telebirr / CBEBirr)**:
        * Phone: `0900123456`
        * [More Mobile Numbers](https://developer.chapa.co/test/testing-mobile)

3. **Automatic Webhook**: Chapa will send a real webhook to your Ngrok URL (`https://...ngrok-free.app/payments/webhook`).
4. **Verification**: Your backend will automatically receive this, verify the signature, and update the booking status.
    > **Skip to Step 4 to verify the status.**

#### Scenario B: Manual Webhook Simulation (No Ngrok)

*Use this if you cannot use Ngrok or want to test the backend logic without a UI interaction.*

Since Chapa cannot reach your `localhost`, you must manually trigger the success event that Chapa *would* have sent.

*Note: You must generate a valid `x-chapa-signature` using your `CHAPA_WEBHOOK_SECRET` and the body content, OR temporarily disable signature verification in `payments.service.ts` for local testing.*

```bash
http POST http://localhost:3000/payments/webhook \
    x-chapa-signature:"<YOUR_HMAC_SHA256_SIGNATURE>" \
    Content-Type:application/json \
    <<< '{
        "event": "charge.success",
        "tx_ref": "GYM-YOUR-TX-REF-HERE",
        "reference": "chapa-ref-12345",
        "amount": "100",
        "currency": "ETB",
        "status": "success",
        "first_name": "Berek",
        "last_name": "Test",
        "email": "customer@example.com"
    }'
```

---

### 4. Verify Payment Status

Check if the payment status has updated to `PROCESSED` and the booking to `CONFIRMED`.

#### Method A: GET Request

```bash
http GET http://localhost:3000/payments/verify/GYM-YOUR-TX-REF-HERE \
    Authorization:"Bearer <TOKEN>"
```

#### Method B: POST Request (Alternative)

```bash
http POST http://localhost:3000/payments/verify \
    Authorization:"Bearer <TOKEN>" \
    Content-Type:application/json \
    <<< '{ "tx_ref": "GYM-YOUR-TX-REF-HERE" }'
```

---

### 5. Refund Payment (Admin Only)

* **Prerequisite**: Login as an **ADMIN** user to get an admin token.
* **Note**: Refunds only work for `PROCESSED` payments.

```bash
http POST http://localhost:3000/payments/refund \
    Authorization:"Bearer <ADMIN_TOKEN>" \
    Content-Type:application/json \
    <<< '{
        "txRef": "GYM-YOUR-TX-REF-HERE",
        "amount": 50,
        "reason": "Customer requested partial refund"
    }'
```

---

### 6. Record Manual Payment (Gym Owner/Admin)

Record a cash payment made physically at the gym.

#### Option A: Class Booking (With Notes)

```bash
http POST http://localhost:3000/payments/record-manual \
    Authorization:"Bearer <STAFF_TOKEN>" \
    Content-Type:application/json \
    <<< '{
        "userId": 2,
        "amount": 200,
        "type": "BOOKING",
        "classBookingId": 5,
        "notes": "Paid in cash at front desk"
    }'
```

#### Option B: Service Booking (Minimal)

```bash
http POST http://localhost:3000/payments/record-manual \
    Authorization:"Bearer <STAFF_TOKEN>" \
    Content-Type:application/json \
    <<< '{
        "userId": 2,
        "amount": 150,
        "type": "BOOKING",
        "serviceBookingId": 8
    }'
```

---

### 7. Transaction Export (Admin/User)

* **Prerequisite**: Login as any user.

#### Basic Export (PDF from specific date)

```bash
http GET http://localhost:3000/payments/export \
    Authorization:"Bearer <TOKEN>" \
    format=="pdf" \
    fromDate=="2025-01-01"
```

#### Export with Date Range (CSV)

```bash
http --download GET http://localhost:3000/payments/export \
    Authorization:"Bearer <TOKEN>" \
    format=="csv" \
    fromDate=="2025-11-01" \
    toDate=="2025-11-30" \
    status=="SUCCESS"
```

---

### 8. Get Transaction History

Retrieve a paginated list of your transactions.

#### Basic History (Paginated)

```bash
http GET http://localhost:3000/payments/history \
    Authorization:"Bearer <TOKEN>" \
    page==1 \
    limit==10
```

#### Advanced Filtering (Date Range & Sorting)

```bash
http GET http://localhost:3000/payments/history \
    Authorization:"Bearer <TOKEN>" \
    status=="SUCCESS" \
    fromDate=="2025-11-01" \
    toDate=="2025-11-30" \
    sortBy=="amount" \
    sortOrder=="desc"
```

---

### 9. Get Single Transaction Details

Retrieve full details for a specific transaction.

```bash
http GET http://localhost:3000/payments/transactions/GYM-YOUR-TX-REF-HERE \
    Authorization:"Bearer <TOKEN>"
```

---

## 🐞 Troubleshooting

* **403 Forbidden (Webhook)**: The `x-chapa-signature` header does not match the hash of the body signed with your `CHAPA_WEBHOOK_SECRET`. Double-check your secret in `.env`.
* **400 Bad Request (Create)**: Ensure the `classBookingId` exists and belongs to the user (or you are Admin).
* **404 Not Found**: The endpoint URL might be wrong, or the ID provided does not exist.
