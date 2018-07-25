import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";

const functions = require('firebase-functions');
const db = admin.database();

export default class NotificationMessageClass {

    public static notificationMessageCloudFunction: HttpsFunction = functions.database.ref('/messages/{chatId}/{messageId}')
        .onCreate((snapshot, context) => {

            // Récupération de la requête et de son Id
            const messageData = snapshot.val();
            const chatId = context.params.chatId;
            const messageId = context.params.messageId;
            const authorId = messageData.uidAuthor;

            console.log('Message envoyé ', messageId, messageData);

            // Récupération du chat
            db.ref('/chats/${chatId}').once('value')
                .catch(reason => console.error(new Error(reason)))
                .then(chatData => {

                    // Récupération du tableau des membres participants au chat
                    let mapMembers: Map<string, boolean> = new Map<string, boolean>();
                    Object.keys(chatData.members).forEach(key => {
                        if (chatData.members[key] === true) {
                            this.mapMembers.set(key, chatData.members[key]);
                        }
                    });

                    // Déduction des receveurs de la notification (tous sauf l'auteur)
                    let receiverIds = [];
                    for (let memberId: string of mapMembers.keys()){
                        if (memberId !== authorId) {
                            receiverIds.push(memberId);
                        }
                    }

                    // Récupération du token dans les paramètres des utilisateurs
                    // TODO voir la solution proposée ici https://stackoverflow.com/questions/39875243/promises-in-the-foreach-loop-typescript-2
                    const tokens = [];
                    function searchTokens(receiverIds): Promise<any>{
                        let promiseArray: Array<any> = [];
                        for(let userId of receiverIds) {
                            promiseArray.push()
                            db.ref('/users/${userId}').once('value')
                                .catch(reason => console.error(new Error(reason)))
                                .then(user => {
                                    tokens.push(user.tokenDevice)
                                });
                        }
                        return Promise.all(promiseArray);
                    }

                    searchTokens(receiverIds).then(value => {

                    });

                    // Notification details.
                    const payload = {
                        notification: {
                            title: 'You have a new follower!',
                            body: '${follower.displayName} is now following you',
                            icon: follower.photoURL
                        }
                    };
                });

            return admin.messaging().sendToDevice(token, payload);

        });
}
