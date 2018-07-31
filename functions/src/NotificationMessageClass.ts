import * as admin from "firebase-admin";
import DataSnapshot = admin.database.DataSnapshot;
import MessagingDevicesResponse = admin.messaging.MessagingDevicesResponse;

const functions = require('firebase-functions');
import {CloudFunction} from "firebase-functions";

try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}


const db = admin.database();

export default class NotificationMessageClass {

    /**
     * Va lire dans Firebase database la liste des ids utilisateur et va récupérer pour chacun d'eux son tokenDevice.
     * Renverra une promesse avec un tableau contenant tous les tokens des utilisateurs
     *
     * @param usersIds : Liste des ids des utilisateurs dont on veut les tokens
     * @returns {Promise<string[]>} Promesse contenant le tableau des tokens
     */
    private static getTokens(usersIds): Promise<string[]> {
        const promiseArray: Array<Promise<string>> = [];
        for (const userId of usersIds) {
            const promesse: Promise<string> = new Promise<string>((resolve, reject) => {
                db.ref('/users/' + userId).once('value')
                    .then(snapshotUser => {
                        const user = snapshotUser.val();
                        resolve(user.tokenDevice);
                    })
                    .catch(reason => {
                        console.error(new Error(reason));
                        reject(reason);
                    });
            });
            promiseArray.push(promesse);
        }
        return Promise.all(promiseArray);
    };

    /**
     * @param tokens
     * @param chatUid
     * @param annonceTitre
     * @param message
     */
    private static sendNotification(tokens: string[], chatUid: string, annonceTitre: string, message: string): Promise<MessagingDevicesResponse> {
        const payload = {
            data: {
                KEY_CHAT_ORIGIN: 'true',
                KEY_CHAT_UID: chatUid
            },
            notification: {
                title: annonceTitre,
                body: message,
                tag: chatUid
            }
        };
        return admin.messaging().sendToDevice(tokens, payload);
    }

    /**
     *
     * @type {CloudFunction<DataSnapshot>}
     */
    public static notificationMessageCloudFunction: CloudFunction<DataSnapshot> = functions.database.ref('/messages/{chatId}/{messageId}')
        .onCreate((snapshot, context) => {

            // Récupération de la requête et de son Id
            const messageData = snapshot.val();
            const chatId = context.params.chatId;
            const messageId = context.params.messageId;
            const authorId = messageData.uidAuthor;

            // Récupération du chat
            return db.ref('/chats/' + chatId).once('value')
                .then(snapshotChat => {

                    // Récupération du tableau des membres participants au chat (tous sauf l'auteur)
                    const receiverIds = [];
                    const chatData = snapshotChat.val();
                    Object.keys(chatData.members).forEach(key => {
                        if (chatData.members[key] === true && key !== authorId) {
                            receiverIds.push(key);
                        }
                    });

                    // Récupération du token dans les paramètres des utilisateurs
                    return NotificationMessageClass.getTokens(receiverIds)
                        .then(tokens => {
                            return NotificationMessageClass.sendNotification(tokens, chatId, chatData.titreAnnonce, messageData.message)
                                .then(value => console.log('Messages correctement envoyés'));
                        });
                });
        });
}
