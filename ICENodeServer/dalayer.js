var sql = require('mssql');

module.exports = function (sqlconn) {

    return {
        //update user status
        updateUserStatus: function (userId, agentState, currentIp, inCall, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('userID', sql.Int, userId);
                request.input('agentState', sql.VarChar, agentState);
                request.input('currentIP', sql.VarChar, currentIp);
                request.input('incall', sql.Int, inCall);
                request.execute('usp_usersUpdateNew', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        },
        //update user activities
        updateUserActivities: function (operatorId, agentState, guid, callback) {
            console.log('Agent and his status:-' + operatorId + '-' + agentState);
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('OperatorId', sql.Int, operatorId);
                request.input('AgentState', sql.Int, agentState);
                request.input('Guid', sql.VarChar, guid);
                request.execute('usp_UpdateOperatorStatusNew', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        },
        //get operator timezone
        getOperatorTimeZone: function (userId, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('UserID', sql.Int, userId);
                request.output('timezone', sql.VarChar);
                request.output('flag', sql.Bit);
                request.execute('GetTimeZoneByOperatorID', function (err, recordsets, returnValue) {
                    callback(err, request.parameters.timezone.value, request.parameters.flag.value);

                });
            });

        },
        //assign operator to given guid(chat)
        assignOperator: function (guid, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('Guid', sql.VarChar, guid);
                request.execute('usp_AssignOperator', function (err, recordsets, returnValue) {
                    callback(err, returnValue);
                });
            });
        },
        //get operator name by operatorId
        getOperatorNameById: function (userId, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('UserID', sql.Int, userId);
                request.execute('usp_GetOperatorNameById', function (err, rs) {
                    callback(err, rs[0][0].forename);
                });
            });
        },
        //get greeting message
        getGreetingMsg: function (guid, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('cq_Guid', sql.VarChar, guid);
                request.output('Greeting', sql.VarChar);
                request.execute('usp_GetGreetingBySubCustomerID', function (err, recordsets, returnValue) {
                    callback(err, request.parameters.Greeting.value);
                });
            });
        },
        //get sandra status
        getIsSandraBySubCustomerID: function (guid, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('cq_Guid', sql.VarChar, guid);
                request.output('IsSandra', sql.VarChar);
                request.execute('usp_GetIsSandraBySubCustomerID', function (err, recordsets, returnValue) {
                    callback(err, request.parameters.IsSandra.value);
                });
            });
        },
        //accept chat
        acceptCall: function (guid, operatorId, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('Guid', sql.VarChar, guid);
                request.input('OperatorId', sql.Int, operatorId);
                request.execute('usp_AcceptCall', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        },
        //clean the chat queue
        cleanCallQueue: function (guid, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('GUID', sql.VarChar, guid);
                request.execute('usp_tbl_CallQueueCleanupByGuid', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        },
        //disconnect operator
        disconnectOperator: function (operatorId, agentState, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('OperatorId', sql.Int, operatorId);
                request.input('AgentState', sql.Int, agentState);
                request.execute('usp_DisconnectOperatorNew', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        },
        //chat transfer
        transferCall: function (currnteOperatoId, newOperatorId, guid, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('CurrentOperatorId', sql.Int, currnteOperatoId);
                request.input('TransferOperatorId', sql.Int, newOperatorId);
                request.input('Guid', sql.VarChar, guid);
                request.execute('usp_TransferChatNew', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        },
        //update conversation status
        updateConversationStatus: function (guid, cType, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('Guid', sql.VarChar, guid);
                request.input('chatType', sql.VarChar, cType);
                request.execute('usp_UpdateConversationStatus', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        },
        //get operator current status

        oprCurrentStatus: function (operatorId, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                console.log('Checking status for agent:-' + operatorId);
                request.input('OperatorId', sql.Int, operatorId);
                request.execute('usp_GetOperatorStatus', function (err, rs) {
                    callback(err, rs[0][0].agentstate);
                });
            });
        },

        //get visitor name from guid

        getVisitorName: function (guid, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('cl_Guid', sql.VarChar, guid);
                request.execute('usp_tbl_CallsLoadByGuid', function (err, rs) {
                    callback(err, rs[0][0].cl_FirstName);
                });
            });
        },

        //get last operator activity

        getLastOperatorActivity: function (operatorId, callback) {
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('OperatorId', sql.Int, operatorId);
                request.execute('usp_getLastOperatorActivity', function (err, rs) {
                    callback(err, rs[0][0].oa_ActivityStatus);
                });
            });
        },

        //save chat transcript
        saveChatHistory: function (items, guid, tzName, callback) {
            var ChatTranscript = "<ChatHistory>";
            items.forEach(function (item) {
                var data = JSON.parse(item);

                var messageType = data.action.toLowerCase();

                if (messageType != "customertyping" && messageType != "customertypingwords" && messageType != "operatortyping" && messageType != "timestampenable" && messageType != "customervideostatus" && messageType != "operatorvideostatus") {
                    //console.log(item);
                    ChatTranscript += "<MessageContent>";
                    ChatTranscript += "<MessageType>";
                    ChatTranscript += data.action;
                    ChatTranscript += "</MessageType>";
                    ChatTranscript += "<TimeZone>";
                    //console.log(ChatTranscript);
                    if (tzName != null && tzName != undefined && tzName != '') {
                        ChatTranscript += tzName;
                    }
                    else {
                        ChatTranscript += "GMT";
                    }
                    ChatTranscript += "</TimeZone>";

                    ChatTranscript += "<TimeStamp>";
                    ChatTranscript += data.servertime;
                    ChatTranscript += "</TimeStamp>";

                    ChatTranscript += "<Message>";
                    ChatTranscript += "<![CDATA[";
                    //ChatToSave.append(chatData.getString("message"));
                    var msg = data.msg;
                    var strMask = "";
                    for (var i = 0; i < msg.length; i++) {
                        var ch = msg[i];


                        switch (ch) {
                            case '1':
                                strMask += "*";
                                break;
                            case '2':
                                strMask += "*";
                                break;
                            case '3':
                                strMask += "*";
                                break;
                            case '4':
                                strMask += "*";
                                break;
                            case '5':
                                strMask += "*";
                                break;
                            case '6':
                                strMask += "*";
                                break;
                            case '7':
                                strMask += "*";
                                break;
                            case '8':
                                strMask += "*";
                                break;
                            case '9':
                                strMask += "*";
                                break;
                            case '0':
                                strMask += "*";
                                break;

                            default: strMask += ch;
                                break;
                        }

                    }
                    ChatTranscript += strMask;

                    ChatTranscript += "]]>";

                    ChatTranscript += "</Message>";
                    ChatTranscript += "<SenderName>";
                    ChatTranscript += data.sender;
                    ChatTranscript += "</SenderName>";

                    ChatTranscript += "<Sender>";
                    ChatTranscript += data.from;
                    ChatTranscript += "</Sender>";
                    ChatTranscript += "</MessageContent>";
                }
            })

            ChatTranscript += "</ChatHistory>";
            ChatTranscript = ChatTranscript.replace(/'/g, "''");
            sql.connect(sqlconn, function (err) {
                var request = new sql.Request();
                request.input('Guid', sql.VarChar, guid);
                request.input('Transcript', sql.VarChar, ChatTranscript);
                request.input('InteractiveChat', sql.TinyInt, 1);
                request.execute('usp_DisconnectCall', function (err, recordsets, returnValue) {
                    callback(err);
                });
            });
        }
    }
};