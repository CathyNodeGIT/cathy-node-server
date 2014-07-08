var redis = require('redis').createClient()
var express = require('express')
//var list = 'sandraList'
var ListAnswers = 'SandraAnswers'

function waitForList() {
    redis.brpoplpush("list1", "list2", 1, gotValueFromList);
}
function gotValueFromList(err, value) {
    var message = JSON.parse(value);

    if (message != undefined && message != 'null' && message != '') {
        var action = message.action;
        console.log(message);
        console.log('---------');
        console.log(action);
        switch (action) {
            case 'validate':
                //Immediately call this, so we wait for a new command again


                //value=JSON.parse(value);
                //nsole.log(message);
                var str = message.CustMsg;
                //str=str.toString();
                str = str.toLowerCase();
                console.log(str);
                if (str.indexOf('balance') != -1) {
                    console.log('I am GuiDDDDDDDDDDDDDDDD-------------------------' + message.GuID + 'xyz');

                    redis.rpush(message.GuID + 'xyz', JSON.stringify({ Action: 'CreateActionItem', GuID: message.GuID, Label: 'Use', InputType: 'button', Message: '<b>Sandra suggests</b>:<font color=#003399>"No problem. I can help you with that. I just have a couple of questions to verify your account information"</font>', ID: 'abc' }));
                }
                break;
            case 'UsedSuggestion':
                //Immediately call this, so we wait for a new command again


                //value=JSON.parse(value);
                console.log(message);
                var str = message.Message;
                //str=str.toString();
                str = str.toLowerCase();
                console.log(str);
                if (str.indexOf('account') != -1) {
                    console.log('-------------------------' + message.GuID + 'xyz');

                    redis.rpush(message.GuID + 'xyz', JSON.stringify({ Action: 'CreateActionValidate', GuID: message.GuID, Label: 'Use', InputType: 'button', Message: '<b>Sandra suggests</b>:<font color=#003399>"Validate customer?"</font>', ID: 'abc1' }));
                }
                break;
            case 'PostChatSurvey':
                if (message != undefined && message != 'null' && message != '') {
                    redis.rpush(message.GuID + 'qwe', JSON.stringify({ GuID: message.GuID, Flag: '4', Question: 'On a scale of 1-10, how would you rate the service provided today?</br><font color="#C58917">(Rate 1-4:Poor,Rate 5-7:Good,Rate 8-10:Excelent)</font>' }));
                    redis.rpush(message.GuID + 'qwe', JSON.stringify({ GuID: message.GuID, Flag: '4', Question: 'Will you use live chat customer service again?' }));
                    redis.rpush(message.GuID + 'qwe', JSON.stringify({ GuID: message.GuID, Flag: '4', Question: 'Please feel free to provide any other information that may make your next experience even better?' }));
                }
                break;
            case 'CreateInChat':
                if (message != undefined && message != 'null' && message != '') {
                    redis.rpush(message.GuID + 'abc', JSON.stringify({ GuID: message.GuID, Flag: '4', Question: 'What is your Acccount No. associated with this account?' }));
                }
                break;
            case 'ResponseOfInchat':

                var guid = message.GuID;
                var ResponseAns = message.ResponseAnswer;
                console.log('i am gUID------' + guid);
                console.log('I am response answer----' + ResponseAns);
                redis.get(ResponseAns, function (err, reply) {
                    console.log(JSON.stringify(reply));
                    console.log('reply');
                    console.log(reply);
                    if (reply == undefined || reply == null || reply == '') {
                        console.log('i am gUID againnnn------' + guid);
                        console.log('i am undefined-------------' + reply);
                        //pub.publish(guid,JSON.stringify({action:'InChat2',GuID:guid}));
                        redis.rpush(guid + 'abc', JSON.stringify({ GuID: guid, Flag: '4', Question: '<font color="#ff0000">We are not able to verify your account by first questions answer because you provided incorrect answer,Please provide correct answer of below question.</font></br>What is your mother maiden name?' }));

                    }
                    else {
                        var Info = JSON.parse(reply);
                        redis.set(guid + 'IscustomerInfo', '1');
                        console.log('CustomerName:-' + Info.Name);
                        console.log('CustomerAddress:-' + Info.Address);

                        //redis.rpush(guid+'asd',JSON.stringify({action:'ResponseOfInChat',GuID:guid, VisitorName:Info.Name,VisitorPhoneNo:Info.PhoneNo,VisitorACNO:Info.AccountNo,VisitorPackege:Info.Packege,VisitorChannels:Info.Channels,VisitorAddress:Info.Address,VisitorDueBillAmt:Info.DueBillAmt,VisitorBillGnrDate:Info.BillGenerationDate,VisitorBillDueDate:Info.BillDueDate,VisitorPossibleEXTDate:Info.PossibleEXTDate,VisitorServices:Info.Services}));
                        redis.rpush(guid + 'asd', JSON.stringify({ action: 'ResponseOfInChat', GuID: guid, VisitorName: Info.Name, VisitorPhoneNo: Info.PhoneNo, VisitorAddress: Info.Address, VisitorActType: Info.AccountType, VisitorBalance: Info.Balance, VisitorActOpDate: Info.AccountOpeningDate }));
                    }
                });
                break;

        }
    }
    waitForList()
}

// To make this loop start, we must call once:
waitForList();