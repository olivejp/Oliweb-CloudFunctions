import {CloudFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import DataSnapshot = admin.database.DataSnapshot;

const functions = require('firebase-functions');

try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}

export default class CreateThumbnail2ClassClass {
    public static createThumbnailCloudFunction: CloudFunction<DataSnapshot> = functions.database.ref('/annonces/{annonceId}/photos/{photoId}')
        .onWrite((data, context) => {
            const urlPhoto = data.after.val();
            const annonceId = context.params.annonceId;
            const photoId = context.params.photoId;

            //get your project storage bucket id
            const storageBucket = functions.config().firebase.storageBucket;
            //open bucket
            const bucket = admin.storage().bucket(storageBucket);
            //location of the image in the bucket
            const object = bucket.file(urlPhoto);

            // const fileBucket = object.bucket; // The Storage bucket that contains the file.
            // const filePath = object.name; // File path in the bucket.
        });
}
