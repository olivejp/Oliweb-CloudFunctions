"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const IndexationAnnonceClass_1 = require("./IndexationAnnonceClass");
const ObserveOnRequestClass_1 = require("./ObserveOnRequestClass");
const DeleteOutdatedRequestsClass_1 = require("./DeleteOutdatedRequestsClass");
const ReindexElasticsearchClass_1 = require("./ReindexElasticsearchClass");
const NotificationMessageClass_1 = require("./NotificationMessageClass");
const DeleteMessageWhenChatDeletedClass_1 = require("./DeleteMessageWhenChatDeletedClass");
const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
}
catch (e) {
}
// TODO Tester cette function
// Cloud function permettant d'envoyer une notification
// Dès que quelqu'un reçoit un message.
exports.sendMessageNotification = NotificationMessageClass_1.default.notificationMessageCloudFunction;
// Function d'indexation des annonces
exports.indexAnnonceToElastic = IndexationAnnonceClass_1.default.indexationCloudFunction;
// Cloud function qui permettra de supprimer l'index annonces sur ES
// Relire toutes la DB sur Firebase Database et réindexer toutes les annonces
exports.reindexElasticsearch = ReindexElasticsearchClass_1.default.reindexElasticsearchHttpsFunction;
// Observe /requests childs on Firebase Database.
// Call ElasticSearch with the query parameters and write the result from ES to /requests/{requestId}/results in Firebase Database
// Or set /requests/{requestId}/no_results = true if no result is return by Elasticsearch
// This way the mobile application never talk to ES directly
exports.observeRequest = ObserveOnRequestClass_1.default.observeOnRequestCloudFunction;
// Cloud function qui sera appelée toutes les 5 minutes pour supprimer les requests qui ont plus de 1 minutes
exports.deleteOutdatedRequests = DeleteOutdatedRequestsClass_1.default.deleteOutdatedRequestsCloudFunction;
// Cloud function qui permet d'écouter tous les chats supprimés et de supprimer les messages correspondants
exports.deleteMessageWhenChatDeleted = DeleteMessageWhenChatDeletedClass_1.default.deleteMessageWhenChatDeletedClassCloudFunction;
//# sourceMappingURL=index.js.map