import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";

const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
import ServerValue = admin.database.ServerValue;

const db = admin.database();

export default class DeleteOutdatedRequestsClass {

    private static getServerTimestamp(): Promise<number> {
        return new Promise((resolve, reject) => {
            db.ref('timestamp').child('now').set(ServerValue.TIMESTAMP, function (error) {
                if (error) {
                    reject(error);
                } else {
                    db.ref('timestamp').child('now').once('value').then(
                        (data) => {
                            resolve(data.val());
                        }, (error1) => {
                            reject(error1);
                        }
                    );
                }
            }).catch(reason => reject(new Error(reason)))
        });
    }

    public static deleteOutdatedRequestsCloudFunction: HttpsFunction = functions.https.onRequest((req, res) => {
        return DeleteOutdatedRequestsClass.getServerTimestamp().then(serverTimestamp => {

            // Liste toutes les requêtes rangées par timestamp
            db.ref('/requests/').orderByChild('timestamp').once('value', listRequests => {

                console.log('Liste des requêtes à traiter : ' + listRequests.val());

                // Parcourt de la liste des requêtes pour savoir celles qui sont à supprimer
                if (listRequests.forEach(fbRequest => {
                    if (serverTimestamp > Number(fbRequest.child('timestamp').val()) + 60 * 1000) {
                        fbRequest.ref.remove()
                            .then(value => console.log('Requête supprimée car trop longue : ' + value))
                            .catch(reason => console.error(new Error('Une requête n\' pas pu être supprimée. Raisons : ' + reason)))
                    }
                    return true;
                })) {
                    console.log('Tout s\'est bien passé');
                    res.status(200).send('OK');
                } else {
                    console.log('Y a eu un soucis avec la boucle de mise à jour');
                    res.status(303).send('FOR LOOP FAIL');
                }
            }).catch(reason => {
                console.log('Y a eu un soucis avec la lecture de la liste');
                res.status(303).send(reason);
            })
        });
    });
}
