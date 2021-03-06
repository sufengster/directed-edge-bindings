import directed_edge
import unittest
import os

class QueryTest(unittest.TestCase):
    def setUp(self):
        self.database = directed_edge.Database(os.environ["DIRECTEDEDGE_TEST_DB"],
                                               os.environ["DIRECTEDEDGE_TEST_PASS"])
        self.database.import_from_file("../testdb.xml")
        self.customer = directed_edge.Item(self.database, "customer1")
        self.product = directed_edge.Item(self.database, "product1")

    def testLinks(self):
        self.assert_(len(self.customer.links) == 15)
        self.assert_("product4" in self.customer.links)
        customer3 = directed_edge.Item(self.database, "customer3")
        self.customer.link_to(customer3, 10)
        self.assert_("customer3" in self.customer.links)
        self.assert_(self.customer.weight_for("customer3") == 10)

    def testTags(self):
        self.assert_(len(self.customer.tags) == 1)
        self.customer.add_tag("foo")
        self.assert_("foo" in self.customer.tags)

    def testRelated(self):
        self.assert_(len(self.product.related([], 5)) == 5)
        self.assert_("product21" in self.product.related(["product"]))

    def testProperties(self):
        self.customer["foo"] = "bar"
        self.assert_(self.customer.properties["foo"] == "bar")
        self.customer["baz"] = "quux"
        self.assert_(self.customer["baz"] == "quux")
        self.assert_(self.customer.get_property("baz") == "quux")
        self.customer.clear_property("baz")
        self.assert_(not self.customer.has_property("baz"))
        self.assert_(not self.customer.get_property("quux"))

    def testSave(self):
        item = lambda name: directed_edge.Item(self.database, name)

        foo = item("Foo")
        foo.add_tag("blah")
        foo.save()
        foo = item("Foo")
        self.assert_("blah" in foo.tags)
        foo = item("Foo")
        foo.remove_tag("blah")
        foo.save()
        foo = item("Foo")
        self.assert_("blah" not in foo.tags)

        foo = item("Foo")
        foo["baz"] = "quux"
        foo.save()
        foo = item("Foo")
        self.assert_(foo["baz"] == "quux")
        foo = item("Foo")
        foo["baz"] = "bar"
        foo.save()
        foo = item("Foo")
        self.assert_(foo["baz"] == "bar")
        foo.clear_property("baz")
        foo.save()
        foo = item("Foo")
        self.assert_("baz" not in foo.properties)        

        bar = item("Bar")
        bar.link_to(foo, 10)
        bar.save()
        bar = item("Bar")
        self.assert_(bar.links["Foo"] == 10)
        bar.unlink_from(foo)
        bar.save()
        bar = item("Bar")
        self.assert_("Foo" not in bar.links)

    def testExport(self):
        exporter = directed_edge.Exporter("exported.xml")
        foo = directed_edge.Item(exporter.database(), "Foo")
        foo.add_tag("blah")
        foo["baz"] = "quux"
        exporter.export(foo)
        exporter.finish()

    def testNonexistant(self):
        item = directed_edge.Item(self.database, "Asdf")
        self.assert_(not item.tags)

if __name__ == '__main__':
    unittest.main()
