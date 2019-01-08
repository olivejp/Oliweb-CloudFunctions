import * as admin from "firebase-admin";
import {default as IndexationAnnonceClass} from "./IndexationAnnonceClass";
import {default as ObserveOnRequestClass} from "./ObserveOnRequestClass";
import DeleteOutdatedRequestsClass from "./DeleteOutdatedRequestsClass";
import ReindexElasticsearchClass from "./ReindexElasticsearchClass";
import NotificationMessageClass from "./NotificationMessageClass";
import DeleteMessageWhenChatDeletedClass from "./DeleteMessageWhenChatDeletedClass";

const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}

// Cloud function permettant d'envoyer une notification
// Dès que quelqu'un reçoit un message.
exports.sendMessageNotification = NotificationMessageClass.notificationMessageCloudFunction;

// Function d'indexation des annonces
exports.indexAnnonceToElastic = IndexationAnnonceClass.indexationCloudFunction;

// Cloud function qui permettra de supprimer l'index annonces sur ES
// Relire toutes la DB sur Firebase Database et réindexer toutes les annonces
exports.reindexElasticsearch = ReindexElasticsearchClass.reindexElasticsearchHttpsFunction;

// Observe /requests childs on Firebase Database.
// Call ElasticSearch with the query parameters and write the result from ES to /requests/{requestId}/results in Firebase Database
// Or set /requests/{requestId}/no_results = true if no result is return by Elasticsearch
// This way the mobile application never talk to ES directly
exports.observeRequest = ObserveOnRequestClass.observeOnRequestCloudFunction;

// Cloud function qui sera appelée toutes les 5 minutes pour supprimer les requests qui ont plus de 1 minutes
exports.deleteOutdatedRequests = DeleteOutdatedRequestsClass.deleteOutdatedRequestsCloudFunction;

// Cloud function qui permet d'écouter tous les chats supprimés et de supprimer les messages correspondants
exports.deleteMessageWhenChatDeleted = DeleteMessageWhenChatDeletedClass.deleteMessageWhenChatDeletedClassCloudFunction;

// Cloud function qui permet de créer des thumbnails de toutes les photos envoyées sur le storage
// exports.createThumbnail = CreateThumbnailClass.createThumbnailFunction;