import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import {getServerTimestamp} from "./GetServerTimestamp";

const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
const db = admin.database();

export default class DeleteOutdatedRequestsClass {
    public static deleteOutdatedRequestsCloudFunction: HttpsFunction = functions.https.onRequest((req, res) => {
        return getServerTimestamp()
            .then(serverTimestamp => {

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
            })
            .catch(reason => console.error(reason));
    });
}
