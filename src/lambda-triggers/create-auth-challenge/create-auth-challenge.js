// ### About this Flow ###
// Using Custom Auth Flow through Amazon Cognito User Pools with Lambda Triggers to complete a 'CUSTOM_CHALLENGE'. 
//
// ### About this function ###
// This CreateAuthChallengeSMS function (2nd of 4 triggers) creates the type of 'CUSTOM_CHALLENGE' as a one-time pass code sent via SMS. A one-time randomly generated 6-digit code (passCode)
// is sent via SMS (through Amazon SNS) to the user's mobile phone number during authentication. The generated passCode is stored in privateChallengeParameters.passCode and passed to the VerifyAuthChallenge function
// that will verify the user's entered passCode (received via SMS) into the mobile/web app matches the passCode passed privately through privateChallengeParameters.passCode.

// ### Next steps ###
// Instead of using the "crypto-secure-random-digit" library to generate random 6-digit codes, create a base32 secret for the user (if not exist) and
// generate a 6-digit code based on this secret. Much like TOTP except for the secret is never shared with the user. With a base32 secret associated with the user,
// we can easily switch from 6-digit code via SMS to 6-digit code generated based on shared secret via TOTP using the OATH module of a YubiKey or an authenticator app.
//
// Updated: Jan 6, 2020
'use strict';

const crypto_secure_random_digit = require("crypto-secure-random-digit");
const AWS = require("aws-sdk");
var sns = new AWS.SNS();
const axios = require("axios");

// Main handler
exports.handler = async (event = {}) => {
    console.log('RECEIVED event:  ', JSON.stringify(event, null, 2));
    
    let passCode;
    var phoneNumber = event.request.userAttributes.phone_number;
    
    // The first CUSTOM_CHALLENGE request for authentication from
    // iOS AWSMobileClient actually comes in as an "SRP_A" challenge (a bug in the AWS SDK for iOS?)
    // web (Angular) comes in with an empty event.request.session
    if (event.request.session && event.request.session.length && event.request.session.slice(-1)[0].challengeName == "SRP_A" || event.request.session.length == 0) {

        passCode = crypto_secure_random_digit.randomDigits(6).join('');
        if(phoneNumber !== '+919999999999'){
            await sendSMSviaExotel(phoneNumber, passCode);
        }
         
    } else {
        
        const previousChallenge = event.request.session.slice(-1)[0];
        passCode = previousChallenge.challengeMetadata.match(/CODE-(\d*)/)[1];
    }
    event.response.publicChallengeParameters = { phone: event.request.userAttributes.phone_number };
    event.response.privateChallengeParameters = { passCode };
    event.response.challengeMetadata = `CODE-${passCode}`;
    
    console.log('RETURNED event: ', JSON.stringify(event, null, 2));
    
    return event;
};

async function sendSMSviaSNS(phoneNumber, passCode) {
    if(phoneNumber !== '+919999999999'){
        //const params = { "Message": `Use OTP ${passCode} to login to your Cookr Account. Cookr doesn't ask for OTP or Contact number to be shared with anyone including Cookr Personnel. bLM48Y63jzo`, "PhoneNumber": phoneNumber };
    var params = {
    Message: `Cookr: Your OTP is ${passCode}, you have requested this OTP for completing your registration with Cookr. PLEASE DO NOT SHARE THIS OTP WITH ANYONE. Orw9FfygPcl`,
    MessageStructure: 'string',
    PhoneNumber: phoneNumber,
    MessageAttributes: {
        "AWS.SNS.SMS.SenderID": {
            DataType: 'String', StringValue: 'Cookr'
        },
        "AWS.SNS.SMS.SMSType": {
            DataType: 'String', StringValue: 'Transactional'
        },
        "AWS.MM.SMS.EntityId": {
            DataType: 'String', StringValue: '1701165718168578728'
        },
        "AWS.MM.SMS.TemplateId": {
            DataType: 'String', StringValue: '1707166375278247471'
        }
    }
};
await sns.publish(params).promise();
}
}

async function sendSMSviaExotel(phoneNumber, passCode) {
    let sms = `Cookr: Your OTP is ${passCode}, you have requested this OTP for completing your registration with Cookr. PLEASE DO NOT SHARE THIS OTP WITH ANYONE. Orw9FfygPcl`
    const key="df4a288becb966ff5970686cfb2c99cfd14dcb525eb60bf5"
    const sid="cookr3"
    const token="013ea0bce3c1f63a3c74734c35b375ac80ab3b3ee5b14c53"
    const from="iCookr"
    const to= phoneNumber
    const body= sms
    const entityId= '1701165718168578728'
    const templateId= '1707166375278247471'
    const smsType= 'transactional'
    
    
    const formUrlEncoded = x =>Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')
    
    const url="https://"+key+":"+token+"@api.exotel.in/v1/Accounts/"+sid+"/Sms/send.json"
    try{
        await axios.post(url, 
            formUrlEncoded({
           "From": from,
           "To": to,
           "Body":body,
           "DltEntityId": entityId,
           "DltTemplateId": templateId,
           "SmsType": smsType,
         }),
         {   
             withCredentials: true,
             headers: {
                 "Accept":"application/x-www-form-urlencoded",
                 "Content-Type": "application/x-www-form-urlencoded"
             }
           },
           );
    } catch (e) {
        await sendSMSviaSNS(phoneNumber, passCode);
    }
    }